const postcss = require('postcss')
const { parse, stringify } = require('css')
const mqpacker = require('css-mqpacker')
const nested = require('postcss-nested')

// styled component expression regex
const expressionsRegex = /__QUASI_EXPR_(\d+)__/g
// styled component id regex
const componentsRegex = /__COMP_ID_(\d+)__/g

const splitExpressions = css => {
  let found
  const matches = []
  while ((found = expressionsRegex.exec(css)) !== null) {
    matches.push(found)
  }
  const { prevEnd, quasiTerms, expressionTerms } = matches.reduce(
    (acc, match) => {
      acc.quasiTerms.push(css.substring(acc.prevEnd, match.index))
      const [placeholder, expressionIndex] = match
      acc.expressionTerms.push(expressionIndex)
      acc.prevEnd = match.index + placeholder.length
      return acc
    },
    { prevEnd: 0, quasiTerms: [], expressionTerms: [] },
  )
  quasiTerms.push(css.substring(prevEnd, css.length))
  return { quasiTerms, expressionTerms }
}

const buildQuasisAst = (t, terms) =>
  terms.map((term, i) =>
    t.templateElement(
      {
        raw: term,
        cooked: term,
      },
      i === terms.length - 1,
    ),
  )

module.exports = ({ types: t }) => ({
  pre() {
    // media queries extracted from styled components
    this.mediaRules = []
    // styled component ids substituted with placeholders
    this.componentSelectors = []
    // styled component expressions substituted with placeholders
    this.expressions = []
  },
  visitor: {
    Program: {
      // media queries from all styled components are packed together on traversal exit
      exit({ node: { body }, scope: { bindings: { injectGlobal } } }) {
        if (this.mediaRules.length <= 0) return
        // stringify media queries object back into css
        let css = stringify({
          type: 'stylesheet',
          stylesheet: {
            rules: this.mediaRules,
            parsingErrors: [],
            ello: [],
          },
        })
        // pack same CSS media query rules into one
        ;({ css } = postcss([mqpacker]).process(css))
        // replace component placeholders with their original values
        css = css.replace(
          componentsRegex,
          (match, id) => `\${${this.componentSelectors[id]}}`,
        )
        // replace expression placeholders with their original values
        css = css.replace(
          expressionsRegex,
          (match, id) => `\${${this.expressions[id].name}}`,
        )
        if (injectGlobal) {
          // add media queries to existing injectGlobal method
          const { referencePaths } = injectGlobal
          const { container: { quasi: { quasis } } } = referencePaths[
            referencePaths.length - 1
          ]
          const { value } = quasis[quasis.length - 1]
          value.raw += css
          value.cooked += css
        } else {
          // otherwise create injectGlobal method THEN insert media queries

          // declare injectGlobal first
          body.unshift(
            t.variableDeclaration('const', [
              t.variableDeclarator(
                t.objectPattern([
                  t.objectProperty(
                    t.identifier('injectGlobal'),
                    t.identifier('injectGlobal'),
                    false,
                    true,
                  ),
                ]),
                t.callExpression(t.identifier('require'), [
                  t.stringLiteral('styled-components'),
                ]),
              ),
            ]),
          )
          // then use it
          body.push(
            t.expressionStatement(
              t.taggedTemplateExpression(
                t.identifier('injectGlobal'),
                t.templateLiteral(
                  [t.templateElement({ raw: css, cooked: css })],
                  [],
                ),
              ),
            ),
          )
        }
      },
    },
    TaggedTemplateExpression(path) {
      const { node: { tag, quasi: { expressions, quasis } } } = path
      const tmatch = () =>
        (tag.object && tag.object.name && tag.object.name === 'styled') ||
        (tag.property && tag.property.name && tag.property.name === 'extend') ||
        (tag.callee && tag.callee.name && tag.callee.name === 'styled') ||
        (tag.callee &&
          tag.callee.object &&
          tag.callee.object.object &&
          tag.callee.object.object.name &&
          tag.callee.object.object.name === 'styled')

      if (!tmatch()) return

      // component selector
      const { parent: { id: { name } } } = path

      const generateExpressionPlaceholder = i => `__QUASI_EXPR_${i}__`
      const generateComponentPlaceholder = i => `__COMP_ID_${i}__`

      let css = quasis.reduce((acc, { value: { raw } }, i) => {
        let expressionPlaceholder = ''
        if (expressions[i]) {
          const expressionIndex = this.expressions.indexOf(expressions[i])
          if (expressionIndex !== -1) {
            expressionPlaceholder = generateExpressionPlaceholder(
              expressionIndex,
            )
          } else {
            this.expressions.push(expressions[i])
            expressionPlaceholder = generateExpressionPlaceholder(
              this.expressions.length - 1,
            )
          }
        }
        return `${acc}${raw}${expressionPlaceholder}`
      }, '')

      let componentPlaceholder
      const componentIndex = this.componentSelectors.indexOf(name)

      if (componentIndex !== -1) {
        componentPlaceholder = generateComponentPlaceholder(componentIndex)
      } else {
        this.componentSelectors.push(name)
        componentPlaceholder = generateComponentPlaceholder(
          this.componentSelectors.length - 1,
        )
      }

      // insert placeholder in place of component selector to allow parsing
      css = `${componentPlaceholder} {${css}}`
      ;({ css } = postcss([nested]).process(css))

      const cssAst = parse(css)
      // now we can extract media queries from template literal
      const { stylesheet: { rules } } = cssAst

      const mediaRules = rules.filter(({ type }, index) => {
        const ifMediaType = type === 'media'
        if (ifMediaType) rules.splice(index, 1)
        return ifMediaType
      })

      // push media queries to global collection
      if (mediaRules.length > 0) this.mediaRules.push(...mediaRules)

      // leftover CSS is converted back to CSS string
      css = stringify(cssAst).replace(componentsRegex, '&')

      const { quasiTerms, expressionTerms } = splitExpressions(css)
      const quasisAst = buildQuasisAst(t, quasiTerms)

      const expressionsAst = expressionTerms.map(
        expressionIndex => this.expressions[expressionIndex],
      )

      // modify template literal to reflect extraction of media queries
      quasis.splice(0, quasis.length, ...quasisAst)
      expressions.splice(0, expressions.length, ...expressionsAst)
    },
  },
})
