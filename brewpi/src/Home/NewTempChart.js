import React from 'react'
import { connect } from 'react-redux'
import { withStyles } from '@material-ui/core/styles'

import { get, range } from 'lodash'

import { ResponsiveLine } from '@nivo/line'

class NewTempChart extends React.Component {
  render() {
    const { tempArray, theme, settings } = this.props

    var temps = tempArray.reduce((acc, val) => {
      range(0, 3).forEach(i => acc[i].data.push({
        x: val.unix,
        y: val[`temp${i + 1}`]
      }))
      return acc
    }, range(1,4).map(val => ({
      id: get(settings, `temperatures.thermistor${String(val)}.name`, `temp${String(val)}`),
      color: theme.colors.graph[`temp${val}`],
      data: []
    })))

    return (
      <div style={{ flex: 1, height: 300 }}>
        <ResponsiveLine
        style={{ color: 'white' }}
          data={temps}
          margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', stacked: true, min: 'auto', max: 'auto' }}
          curve="catmullRom"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            orient: 'bottom',
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'transportation',
            legendOffset: 36,
            legendPosition: 'middle'
          }}
          axisLeft={{
            orient: 'left',
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'count',
            legendOffset: -40,
            legendPosition: 'middle'
          }}
          enableGridX={false}
          colors={{ scheme: 'nivo' }}
          lineWidth={3}
          enablePoints={false}
          pointSize={10}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'serieColor' }}
          pointLabel="y"
          pointLabelYOffset={-12}
          areaBlendMode="lighten"
          areaOpacity={0.3}
          useMesh={true}
          legends={[
            {
              anchor: 'bottom-right',
              direction: 'column',
              justify: false,
              translateX: 100,
              translateY: 0,
              itemsSpacing: 0,
              itemDirection: 'left-to-right',
              itemWidth: 80,
              itemHeight: 20,
              itemOpacity: 0.75,
              symbolSize: 12,
              symbolShape: 'circle',
              symbolBorderColor: 'rgba(0, 0, 0, .5)',
              effects: [
                {
                  on: 'hover',
                  style: {
                    itemBackground: 'rgba(0, 0, 0, .03)',
                    itemOpacity: 1
                  }
                }
              ]
            }
          ]}
        />
      </div>
    )
  }
}

NewTempChart.propTypes = {
}

const mapStateToProps = (state) => ({
  settings: state.settings,
  tempArray: state.temperatureArray,
})

export default withStyles(null, { withTheme: true })(connect(mapStateToProps, {
})(NewTempChart))
