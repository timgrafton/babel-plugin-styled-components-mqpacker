# babel-plugin-styled-components-mqpacker

Babel plugin for packing [styled components](https://github.com/styled-components/styled-components) CSS media queries together.

### Prerequisites

* babel-core
* babel-preset-env
* babel-preset-react

### Installation

```
npm install babel-plugin-styled-components-mqpacker --save-dev
```

### Example

**Before:**

```
const ItemColor = '#D9BF9C'

const List = styled.ul`
  list-style-type: none;
  margin: 0;
  padding: 0;
  font-size: 25px;
  text-align: center;
  background-color: #F2DDC0;
  color: ${ItemColor};

  @media screen and (min-width: 480px) {
    display: inline-block;
  }
`

const Item = styled.li`
  padding: 10px 0 10px;

  @media screen and (min-width: 480px) {
    padding: 0 10px 0 10px;
    float: left;

    &:hover {
      text-decoration:underline white;
      cursor: pointer;
    }
  }
`

injectGlobal`
  body {
    background-color: white;
  }
`
```

**After:**

```
const ItemColor = '#D9BF9C';

const List = styled.ul`& {
  list-style-type: none;
  margin: 0;
  padding: 0;
  font-size: 25px;
  text-align: center;
  background-color: #f2ddc0;
  color: ${ItemColor};
}`;

const Item = styled.li`& {
  padding: 10px 0 10px;
}`;

injectGlobal`
  body {
    background-color: white;
  }
  @media screen and (min-width: 480px) {
    ${List} {
      display: inline-block;
    }
    ${Item} {
      padding: 0 10px 0 10px;
      float: left;
    }

    ${Item}:hover {
      text-decoration: underline white;
      cursor: pointer;
    }
  }
`;
```

### Configuration

**.babelrc**

```
{
    "plugins": [
      "styled-components-mqpacker"
    ]
}
```

This plugin uses [postcss](https://github.com/postcss/postcss) and [css-mqpacker](https://github.com/hail2u/node-css-mqpacker) to extract media queries from styled components and puts them into the injectGlobal block. If injectGlobal is not used it will be created.
