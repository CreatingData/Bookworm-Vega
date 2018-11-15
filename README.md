This library is intended to replace the old Bookworm-D3 library. It
translates a variety of simple plot types from the old library into
Vega-Lite specs, and then embeds them on a target div.


It's still in a very early stage of development, but is suitable for
building a few visualizations. I also hope to make it embeddable in
observable notebooks pretty soon.

It should really be an ES6 module, but for now it's just a single
'index.js' file thaht you can import.


### API

Base keys

* `plottype`: ["linechart", "heatmap", "pointchart"]
* `vega`: Any other arguments can be passed straight through to the vega spec.
   This overwrites any default fields.
   E.g.:
   ```javascript
   {"vega": {"title": "My plot title"}}
   ```
* `aesthetic`: ["x", "y", "color"], etc. See plots for supported elements.
  * This is an object map. 
  * When a bookworm contains multiple search limits, the aesthetic `Search` (capitalized)
     can be used to refer to the different search terms.
  * E.g., `"aesthetic": {"x": "date_year", "y": "classification", "color": "Search"}`
     
### Supported plots

Vega supports a powerful grammar of graphics, which can be accessed directly
through the `vega` key. The 'plottype'

* `heatmap` Required aesthetics: 'x' and 'y' (ordinal, numeric, or date); 'fill' (ordinal)
* `linechart`. 'x', 'y', and 'color' supported.
* `barchart`. Required aesthetics 'y' and 'x'. I generally make the x axis numeric and the
   y axis categorical for text plotting.
* `pointchart`: 'x', 'y', and 'color'. This works better than a line chart with categorial variables.
   By default, the y axis is sorted by count.
* `USchoropleth`. A US state choropleth map.
  * Required aesthetics 'state', which gives a database field with the **full name** of the state.
    (It would be nice to include postal code, but that's for later).




