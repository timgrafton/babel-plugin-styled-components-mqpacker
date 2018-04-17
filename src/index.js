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

  const { prevEnd, quasiTerms, exprTerms } = matches.reduce(
    (acc, match) => {
      acc.quasiTerms.push(css.substring(acc.prevEnd, match.index))
      const [placeholder, expressionIndex] = match
      acc.exprTerms.push(expressionIndex)
      acc.prevEnd = match.index + placeholder.length
      return acc
    },
    { prevEnd: 0, quasiTerms: [], exprTerms: [] },
  )

  quasiTerms.push(css.substring(prevEnd, css.length))

  return { quasiTerms, exprTerms }
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
    this.compNames = []
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
        // pack media queries
        ;({ css } = postcss([mqpacker]).process(css))

        // replace placeholders back with their original values
        css = css.replace(componentsRegex, (match, id) => `\${${this.compNames[id]}}`)
        css = css.replace(
          expressionsRegex,
          (match, id) => `\${${this.expressions[id].name}}`,
        )

        // insert injectGlobal declaration if not already exists
        if (injectGlobal) {
          const { referencePaths } = injectGlobal
          const { container: { quasi: { quasis } } } = referencePaths[
            referencePaths.length - 1
          ]
          const { value } = quasis[quasis.length - 1]
          value.raw += css
          value.cooked += css
        } else {
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

      const { parent: { id: { name } } } = path

      const expressionPlaceholder = i => `__QUASI_EXPR_${i}__`
      const compPlaceholder = i => `__COMP_ID_${i}__`

      let css = quasis.reduce((acc, { value: { raw } }, i) => {
        let expr = ''
        if (expressions[i]) {
          const expressionIndex = this.expressions.indexOf(expressions[i])
          if (expressionIndex !== -1) {
            expr = expressionPlaceholder(expressionIndex)
          } else {
            this.expressions.push(expressions[i])
            expr = expressionPlaceholder(this.expressions.length - 1)
          }
        }
        return `${acc}${raw}${expr}`
      }, '')

      let comp

      const compIndex = this.compNames.indexOf(name)

      if (compIndex !== -1) {
        comp = compPlaceholder(compIndex)
      } else {
        this.compNames.push(name)
        comp = compPlaceholder(this.compNames.length - 1)
      }

      css = `${comp} {${css}}`
      ;({ css } = postcss([nested]).process(css))

      const cssObj = parse(css)

      const { stylesheet: { rules } } = cssObj

      const mediaRules = rules.filter(({ type }, index) => {
        const cond = type === 'media'
        if (cond) rules.splice(index, 1)
        return cond
      })

      if (mediaRules.length > 0) this.mediaRules.push(...mediaRules)

      css = stringify(cssObj).replace(componentsRegex, '&')

      // extract expressions from css
      const { quasiTerms, exprTerms } = splitExpressions(css)
      // get quasis from AST
      const quasisAst = buildQuasisAst(t, quasiTerms)

      const exprsAst = exprTerms.map(expressionIndex => this.expressions[expressionIndex])

      quasis.splice(0, quasis.length, ...quasisAst)
      expressions.splice(0, expressions.length, ...exprsAst)
    },
  },
})
