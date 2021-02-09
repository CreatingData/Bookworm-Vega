import * as charts from "./translators.js";
// The base query schema.s

export const counttypes = {
  "WordsPerMillion":"Uses per Million Words",
  "WordCount":"# of matches",
  "TextPercent":"% of texts",
  "TotalWords":"Total # of words",
  "TextCount":"# of Texts",
  "TotalTexts":"Total # of Texts",
  "WordsRatio":"Ratio of group A to B",
//  "TextRatio":"Ratio of texts",
//  "SumWords":"Total in both sets",
  "TextLength":"Mean text length (in words)",
//  "MatchesPerText":"Mean hits per matching text",
//  "TFIDF":"TFIDF",
//  "Dunning":"Dunning Log Likelihood",
//  "DunningTexts":"Dunning Log Likelihood (Text count)",
//  "PMI_texts":"Pointwise Mutual Information across # of texts.",
//  "PMI_words": "PMI across number of words."
}


// The precise schema for a query will differ from Bookworm to Bookworm.
export const base_schema = {
  "definitions": {
    "count_type": {"type": "string", "enum": [], "name": "Count type"},
    "metadata": {"type": "string", "enum": ["word", "Search"], "name": "Metadata fields"},
    "anything": {"type":"string", "enum": [], "name": "field"},
    "any_data": {"anyOf": [{"$ref": "#/definitions/count_type"}, {"$ref": "#/definitions/metadata"}]},
    "number_limit": {
      "type": "object",
      "properties": {
        "$gt": {"type": "number", "title": "Greater than"},
        "$lt": {"type": "number"},
        "$eq": {"type": "number"}
      }
    },
    "categorical_limit": {
          "type": "array",
  //    "title": "Categorical limit",
      "items": {"type": "string", "name": "value", "title": "item"}
    },
    "search_limit": {
      "title": "Search Limit.",
      "type": "object",
      "$comment": "The react validation can't handle the complexity here: " +
      "it breaks when you add a oneOf to the field all the way in here.",
      "description": "A set of limitations: keys are metadata fields" +
      " and values are limits.",
      "propertyNames": {"$ref": "#/definitions/metadata"},
      "additionalProperties": {
//        "description": "List of possible matches.",
//        "$comment": "THIS IS ACTUALLY MUCH MORE COMPLICATED. NEEDS '$gt', etc",
  //    "oneOf": [{
                //},
      "type": "array",
      "title": "Categorical limit",
      "items": {"type": "string", "name": "value", "title": "item"}

//  }]
    }},
    "search_limit_element": {
      "oneOf": [
          {
            "description": "An array of limits: each will return a separate set of data " +
            "with a new metadata field called 'Search.'" ,
            "type": "array",
            "title": "Multiple limits",
            "items": {"$ref": "#/definitions/search_limit"}
          },
          {"$ref": "#/definitions/search_limit",
           "title": "Single limit."},
        ]
    },
    "aesthetic": {
      "description": "A possible value for an aesthetic mapping to take.",
      /*"anyOf": [
        {"$ref": "#/definitions/count_type", "name": "Count type"},
        {"$ref": "#/definitions/metadata", "name": "Metadata"}
      ],*/
      //"$ref": "#/definitions/anything",
      "type": "string",
      "default": "WordCount",
      "enum": ["foo", "bar"]
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://bookworm.benschmidt.org/schema.json",
  "title": "Bookworm charting API",
  "description": "The Bookworm charting API adapts the bookworm query API" +
  " to allow direct descriptions of plots and queries as a passable object." +
  " It merges elements of a mongoDB-inflected search syntax with a simplified" +
  " Vega-Lite plotting description." ,
  "type": "object",
  "required": [
    "plottype",
    "aesthetic",
    "search_limits"
  ],
  "optional": [
    "smoothingSpan",
    "vega",
    "words_collation"
  ],
  "properties": {
    "plottype": {
      "type": "string",
      "title": "Chart type",
      "description": "A pre-generated chart type defined in bookworm-vega library.",
      "default": "barchart",
      "enum": Object.keys(charts)
    },
    "database": {
      "type": "string",
      "title": "Database",
    },
    "smoothingSpan": {
      "$id": "#/properties/smoothingSpan",
      "type": "integer",
      "description": "Whether to smooth continuous data. Handled internally.",
      "$comment": "This might be moved at some point to a Vega-Lite kernel smoother.",
      "title": "Smooth",
      "description": "Years to smooth by",
      "default": 0,
      "minimum": 0,
      "maximum": 40,
      "examples": [
        0
      ]
    },
    "aesthetic": {
          "type": "object",
          "title": "Aesthetic Mapping",
          "description": "A set of mapping between scales and data, like the 'aes' function in" +
          " ggplot2 or the 'encoding' channel in Vega.",
          "propertyNames": {
            "$comment": "Could potentially pull straight from the vega-lite schema.",
            "description": "The Vega-lite encoding channel",
            "type": "string",
            "enum": ["x", "y", "row", "column", "color", "opacity",
                     "strokeOpacity", "strokeWidth", "size", "shape", "text",
                     "order", "facet", "detail"]
          },
          "additionalProperties": {
            "type": "string",
            "default": "WordCount",
            "enum": ["foo", "bar"]
          }
    },
    "search_limits": {
      "$ref": "#/definitions/search_limit_element"
    },
    "words_collation": {
      "type": "string",
      "enum": ["Case_Sensitive", "Case_Insensitive"],
      "default": "Case_Sensitive"
    },
    "vega": {
      "$id": "#/properties/vega",
      "type": "object",
      "title": "Vegalite options",
      "description": "Additional values passed directly to Vega-Lite. These " +
      " will override the simpler chart types set by 'plottype.'",
      "optional": [
        "title"
      ],
      "properties": {
        "title": {
          "$id": "#/properties/vega/properties/title",
          "type": "string",
          "title": "Title",
          "default": "Number of books",
          "examples": [
            "Number of books in the Hathi trust by year, top 12 languages."
          ],
          "pattern": "^(.*)$"
        }
      }
    }
  }
}
