# babel-plugin-styled-components-mqpacker

Babel plugin for packing [styled components](https://github.com/styled-components/styled-components) CSS media queries together

### Example
```
npm install babel-plugin-styled-components-mqpacker --save-dev
```

**Before:**
```
const Arrow = styled.div`
  background-color: blue;
`

const color = 'rebeccapurple'

const RightArrow = styled.div`
  @media screen and (min-width: 480px) {
    background-color: ${color};
    ${Arrow}:hover > & {
      background-color: orange;
    }
  }
`

const LeftArrow = styled.div`
  @media screen and (min-width: 480px) {
    background-color: #000;
  }
`

injectGlobal`
  body {
    background-color: blue;
  }
`
```

**After:**
```
const Arrow = styled.div`& {
  background-color: blue;
}`;
const color = 'rebeccapurple';
const RightArrow = styled.div``;
const LeftArrow = styled.div``;
injectGlobal`
  body {
    background-color: blue;
  }
  @media screen and (min-width: 480px) {
    ${RightArrow} {
      background-color: ${color};
    }

    ${Arrow}:hover > ${RightArrow} {
      background-color: orange;
    }
    ${LeftArrow} {
      background-color: #000;
    }
  }
`;
```

This plugin uses [postcss](https://github.com/postcss/postcss) and [css-mqpacker](https://github.com/hail2u/node-css-mqpacker) to extract media queries from styled components and puts them into the injectGlobal block. If injectGlobal is not used it will be created.
