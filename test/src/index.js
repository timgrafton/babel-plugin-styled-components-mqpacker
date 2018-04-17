let React
let styled
let injectGlobal

const Arrow = styled.div`
  background-color: blue;
`

const color = 'rebeccapurple'

const RightArrow = styled.div`
  background-color: green;
  flex: 2;
  
  > a {
    flex: 4;
  }

  ${Arrow}:hover > & {
    background-color: orange;
  }

  @media screen and (min-width: 400px) {
    background-color: ${color};
    ${Arrow}:hover > & {
      background-color: orange;
    }
  }
`

injectGlobal`
  body {
    background-color: blue;
  }
`

export default () => <div><RightArrow /></div>
