import React from 'react'
import { connect } from 'react-redux'
import { withStyles, createStyles, useTheme } from '@material-ui/core/styles'

import numeral from 'numeral'

import { ResponsiveLine } from '@nivo/line'

const styles = (theme) => createStyles({
  toolTip: {
    backgroundColor: "white",
    border: "2px solid " + theme.palette.primary.main,
    borderRadius: theme.spacing(2),
    padding: theme.spacing(2),
    fontFamily: "Helvetica",
    fontSize: 12,
    fontWeight: "bold",
    boxShadow: "0px 5px 15px rgba(0,0,0,0.1)",
    marginBottom: theme.spacing(2),
  }
})

const NewTempChart = props => {
  const { classes, tempArray } = props
  const theme = useTheme()

  const { temp1, temp2, temp3 } = theme.colors.graph
  const colors = [ temp1, temp2, temp3 ]

  const toolTipElement = (props) => {
    const { point: { color, data }} = props
    return <div className={classes.toolTip} style={{ borderColor: color, color }}>
        {numeral(data.y).format('0.0')} °F
    </div>
  }

  return (
    <div style={{ flex: 1, height: 300 }}>
      <ResponsiveLine
        data={tempArray}
        margin={{ top: 0, right: 120, bottom: 30, left: 50 }}
        xScale={{
          type: 'time',
          format: '%Y-%m-%dT%H:%M:%S%Z',
          precision: 'second',
        }}
        xFormat="time:%Y-%m-%d"
        yScale={{
          type: 'linear',
          stacked: false,
          min: 'auto',
          max: 'auto'
        }}
        axisLeft={{
          legendOffset: 20,
        }}
        axisBottom={{
          format: '%I:%M %p',
          legendOffset: -12,
        }}
        curve='catmullRom'
        animate={false}
        useMesh={true}
        enablePoints={false}
        enableGridX={false}
        enableSlices={false}
        theme={{
          axis: {
            ticks: {
              text: {
                fill: 'white'
              }
            }
          }
        }}
        tooltip={toolTipElement}
        colors={colors}
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
            textColor: '#fff',
            itemTextColor: '#fff',
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
      //   style={{ color: 'white' }}
      //   data={tempArray}
      //   margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
      //   xScale={{
      //     type: 'time',
      //     format: '%Y-%m-%dT%H:%M:%S%Z',
      //     precision: 'second'
      //   }}
      //   yScale={{ type: 'linear', stacked: false, min: 'auto', max: 'auto' }}
      //   curve="catmullRom"
      //   axisTop={null}
      //   axisRight={null}
      //   axisBottom={{
      //     orient: 'bottom',
      //     tickSize: 5,
      //     tickPadding: 5,
      //     tickRotation: 0,
      //     legend: 'transportation',
      //     legendOffset: 36,
      //     legendPosition: 'middle'
      //   }}
      //   axisLeft={{
      //     orient: 'left',
      //     tickSize: 5,
      //     tickPadding: 5,
      //     tickRotation: 0,
      //     legend: 'count',
      //     legendOffset: -40,
      //     legendPosition: 'middle'
      //   }}
      //   enableGridX={false}
      //   colors={{ scheme: 'nivo' }}
      //   lineWidth={3}
      //   enablePoints={false}
      //   pointSize={10}
      //   pointColor={{ theme: 'background' }}
      //   pointBorderWidth={2}
      //   pointBorderColor={{ from: 'serieColor' }}
      //   pointLabel="y"
      //   pointLabelYOffset={-12}
      //   areaBlendMode="lighten"
      //   areaOpacity={0.3}
      //   useMesh={true}
      />
    </div>
  )
}

const mapStateToProps = (state) => ({
  settings: state.settings,
  tempArray: state.temperatureArray,
})

export default withStyles(styles)(connect(mapStateToProps, {
})(NewTempChart))
