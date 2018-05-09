let React
let styled
let injectGlobal

const ItemColor = '#D9BF9C'

const List = styled.ul`
  list-style-type: none;
  margin: 0;
  padding: 0;
  font-size: 25px;
  text-align: center;
  background-color: #f2ddc0;
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
      text-decoration: underline white;
      cursor: pointer;
    }
  }
`

injectGlobal`
  body {
    background-color: white;
  }
`

export default () => (
  <div>
    <h1>Shopping List</h1>
    <List>
      <Item>Tomatoes</Item>
      <Item>Onions</Item>
      <Item>Asparagus</Item>
    </List>
  </div>
)
