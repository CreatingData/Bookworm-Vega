import * as charts from "./translators";
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
//  "TextLength":"Mean text length (in words)",
//  "MatchesPerText":"Mean hits per matching text",
//  "TFIDF":"TFIDF",
//  "Dunning":"Dunning Log Likelihood",
//  "DunningTexts":"Dunning Log Likelihood (Text count)",
//  "PMI_texts":"Pointwise Mutual Information across # of texts.",
//  "PMI_words": "PMI across number of words."
}

export const base_schema = {
  "definitions": {},
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://example.com/root.json",
  "type": "object",
  "required": [
    "plottype",
    "aesthetic",
    "search_limits",
    "host",
    "database"
  ],
  "optional": [
    "smoothingSpan",
    "vega",
    "words_collation"
  ],
  "properties": {
    "plottype": {
      "$id": "#/properties/plottype",
      "type": "string",
      "title": "Chart type",
      "default": "barchart",
      "enum": Object.keys(charts),
      "pattern": "^(.*)$"
    },
    "smoothingSpan": {
      "$id": "#/properties/smoothingSpan",
      "type": "integer",
      "title": "Smooth",
      "description": "Years to smooth by",
      "default": 0,
      
      "examples": [
        0
      ]
    },
    "host": {
      "$id": "#/properties/host",
      "type": "string",
      "title": "Host",
      "default": "http://localhost:10012/",
      "examples": [
        "http://localhost:10012/"
      ],
      "pattern": "^(.*)$"
    },
    "database": {
      "$id": "#/properties/database",
      "type": "string",
      "title": "Database name",
      "default": "articles",
      "examples": [
        "federalist_bookworm"
      ],
      "pattern": "^(.*)$"
    },
    "aesthetic": {
      "$id": "#/properties/aesthetic",
      "type": "object",
      "title": "The Aesthetic Schema",
      "required": [
        "x",
        "y"
      ],
      "properties": {
        "x": {
          "type": "string",
          "default": "WordCount",
          "enum": Object.keys(counttypes),
        },
        "y": {
          "$id": "#/properties/aesthetic/properties/y",
          "type": "string",
          "title": "y",
          "default": "author",
          "enum": [
            "author",
            "fedNumber",
            "paragraphNumber"
          ],
          "pattern": "^(.*)$"
        },
        "color": {
          "$id": "#/properties/aesthetic/properties/y",
          "type": "string",
          "default": "author",
          "enum": [
          ],
          "pattern": "^(.*)$"
        }        
        
      }
    },
    "search_limits": {
      "$id": "#/properties/search_limits",
      "type": "object",
      "title": "Search Limits",
      "properties": {
        
      }
    },
    "vega": {
      "$id": "#/properties/vega",
      "type": "object",
      "title": "Vegalite options",
      "required": [
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

