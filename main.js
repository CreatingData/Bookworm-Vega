import './style.css'
// import 'vega-embed/vega-embed.scss'
import vegaEmbed from 'vega-embed';
import VegaBookworm from './lib/main';

VegaBookworm.prototype.getVegaEmbed = function() {
  return Promise.resolve(vegaEmbed)
}

document.querySelector('#app').innerHTML = `
  <h1>Bookworm!</h1>
`

const test_query = {
  database: 'SOTU',
  host: '//localhost:10012',
  plottype: 'linechart',
  search_limits: [{
    'word': ["God"],
  }, {
    'word': ["Providence"],
  }],
  aesthetic: {
    x: "year",
    y: "WordsPerMillion",
    color: "Search"
  }
}

const bookworm = new VegaBookworm("#app", test_query)
window.plot = bookworm
bookworm.plotAPI(test_query)

