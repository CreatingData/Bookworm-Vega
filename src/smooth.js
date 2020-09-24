import { mean, sum, min, max, range } from 'd3-array';
import { keys, set, nest } from 'd3-collection';

export default function smooth(data, span, smoothingBy, quantKeys, kernel, weights) {
  // Todo--reimplement this using more modern D3.
  return data;
  if (span <= 0) {return data}
  let kernelSmoother;
  kernel = kernel || "sine"

  if (kernel == "average") {
    kernelSmoother = function(array) {
      return mean(array)
    }
  }

  if (kernel=="sine") {
    kernelSmoother = function(array) {
      //By default, use a sine-wave shaped smoothing kernel.
      var length = array.length
      var midpoint = (length-1)/2
      var weighter = function(i) {
        return Math.cos((midpoint-i)/(length+2)*Math.PI/2)
      }
      var totalWeights = 0;
      var i = 0
      const weightedVals = array.map(function(d) {
        var weight = weighter(i);
        totalWeights += weight;
        i++;
        return (d * weight)

      })
      var total = sum(weightedVals)/totalWeights
      return total
    }
  }

  /*the funny thing about smoothing is that when it's multivariate, 
        we need to create some entries to interpolate 0 counts: if Britain 
        has a series from 1066 to 2000, and the US only from 1776 to 1860 
        and 1865 to 2000, we want to interpolate a whole bunch of zeroes 
        before 1776 and 1860. But if there's a series of US grain and cattle 
        exports but only British grain exports, there's no need to create a 
        dummy set of British cattle exports consisting only of zeroes. Probably.
        (I don't know, maybe there is?)
        */

  //Assuming zero for no data is also problematic in all sorts of ways; this needs a "step" variable.

  //This code accomplishes that

  //using nest to avoid expensive filters.

  const allKeys = keys(data[0])
  
  var groupings = allKeys.filter(function(key) {
    if (quantKeys.indexOf(key)>-1) {return false}
    if (key == smoothingBy) {return false}
    return true
  })
        
  var completeNesting = nest()

  //nest by each of the groupings
  groupings.forEach(function(key) {
    completeNesting.key(function(d) {
      return d[key]
    })
  })


  console.log(groupings)
        
  //nest by the thing itself.
  completeNesting.key(function(d) {
    return d[smoothingBy]
  })

  if (kernel !== "faussian") {
            
  var timeStamps = set(data.map(d => d[smoothingBy]))
    .values()
    .sort(function(a,b) {return parseFloat(a)-parseFloat(b)})

  var timeGroups = timeStamps
     .map(function(d,i) {
       return timeStamps.slice(max([0,i-span]),min([timeStamps.length, i + span + 1]) )
     })
  }

  var completeIndex = completeNesting.map(data)
  
  //One element per each interaction of variables in the groupings:
  // recreated by recursively descending the first levels of the completeIndex hierarchy.
  var recurse = function(map, labels) {
    var key = labels[0];
    if (labels.length == 1) {
      return map.keys()
        .map(function(d) {
          var a = {};
          a[key] = d;
          a['values'] = map.get(d)
          return a
        })
    } else {
      let returnVal = []
      console.log(map)
      Array.from(map.keys()).forEach(function(key2) {
        const vals = recurse(map.get(key2), labels.slice(1))
        returnVal = returnVal.concat(vals.map(function(d) {
          d[key] = key2
          return d
        }))
      })
      return returnVal
    }
  }

  const blur = (data, properties) => data.map((d, i) => {
    const previous = (i === 0) ? i : i - 1;
    const next = (i === data.length - 1) ? i : i + 1;
      const datums = [data[previous], d, data[next]];
      properties.forEach(property => {
        const wweights = datums.map(dd => {
            if (weights) {return dd[weights]}
            return 1
        })
        const values = datums.map( (dd, ii) => {
        return dd[property]// * wweights[ii]
        })
      d[property] = sum(values)/3//sum(wweights)
    })
    return d;
  });

  var hierarchy =  recurse(completeIndex, groupings)
  var smoothedData = []

  hierarchy.forEach(function(hierarchyLevel) {
    //clone a new object off of the values for the level.
    var locEntries

    if (kernel === "faussian") {
     const vals = JSON.parse(JSON.stringify(hierarchyLevel.values.values().map(d => d[0])))
     vals.sort( (a, b) => {
         return a[smoothingBy] - b[smoothingBy]
     })
     range(span).forEach( i => {
         locEntries = blur(vals, quantKeys.filter(d => d !== weights))
     })
     smoothedData.push(...locEntries)
    } else {
        locEntries = {}
        hierarchyLevel['values']
      .keys()
      .forEach(k => {
        locEntries[k] = hierarchyLevel['values'][k]
      })        
    timeGroups.map(function(timesToMerge, i) {
      var newOut = {};
      keys(hierarchyLevel).forEach(k => {
        if (k != "values") {
          newOut[k] = hierarchyLevel[k] 
        }
      })
      newOut[smoothingBy] = timeStamps[i]
      quantKeys.forEach(function(key) {
        //For each quantitative key, there's a different value to smooth.
        //Currently we work across them, not combining. (I think).
        const values = timesToMerge.map(function(d) {
          const val = hierarchyLevel.values.get(d)
          if (val==undefined) {return 0}
          return val[0][key]
        })
        //Set the smoothed data equal to whatever smoothing kernel is being used
        newOut[key] = kernelSmoother(values)
      })
      smoothedData.push(newOut)
    })
    }  
  })
  return smoothedData;
}
