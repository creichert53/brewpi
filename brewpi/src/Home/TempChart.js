import React from 'react'
import { connect } from 'react-redux'
import { withStyles } from '@material-ui/core/styles'

import numeral from 'numeral'

import timeFormat from '../helpers/hhmmss'
import TempTooltip from './TempTooltip'

import {
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LineChart, Line
} from 'recharts'

class TempChart extends React.Component {
  render() {
    const { temps, theme, settings } = this.props

    return (
      <div style={{ flex: 1, height: 300 }}>
        <ResponsiveContainer width='100%' height={300}>
          <LineChart data={temps} margin={{top: 5, right: 5, bottom: 3, left: -20}}>
            <XAxis
              dataKey='brewTime'
              domain={['auto', 'auto']}
              name='Time'
              tickFormatter={(time) => timeFormat.fromS(time, 'hh:mm:ss').split(':').reduce((acc,val,i) => {
                var num = numeral(val)
                if (acc.length === 0 && (num.value() > 0 || i === 1)) {
                  acc.push(num.format('0'))
                } else if (num.value() > 0) {
                  acc.push(num.format('00'))
                }
                return acc
              }, []).join(':')}
              type='number'
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(value) => value ? value.toFixed(1) : 0}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip isAnimationActive={false} content={<TempTooltip/>}/>
            <CartesianGrid stroke='#c7c7c7' strokeDasharray='3 3' />
            <Line
              stroke={theme.colors.graph.temp1}
              dot={false}
              dataKey='temp1'
              type='monotoneX'
              connectNulls
              isAnimationActive={false}
              name={settings.thermistor1.name}
            />
            <Line
              stroke={theme.colors.graph.temp2}
              dot={false}
              dataKey='temp2'
              type='monotoneX'
              connectNulls
              isAnimationActive={false}
              name={settings.thermistor2.name}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }
}

TempChart.propTypes = {
}

const mapStateToProps = (state) => ({
  settings: state.settings.temperatures
})

export default withStyles(null, { withTheme: true })(connect(mapStateToProps, {
})(TempChart))
