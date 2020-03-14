import cloneDeep from 'lodash/cloneDeep'

import {
  SETTINGS,
  HEATER_SETTINGS,
  TEMP_SETTINGS,
  THERMISTOR_SETTINGS,
  CHART_WINDOW
} from '../types'

const initialState = {
  temperatures: {
    logTemperatures: false,
    chartWindow: 10,
    mashTempInterval: 1,
    boilTempInterval: 30,
    thermistor1: {
      expanded: false,
      iceTemp: 32,
      boilTemp: 212,
      boilBaseline: 208,
      name: 'Hot Liquor Tank',
      useSetpointAdjust: false
    },
    thermistor2: {
      expanded: false,
      iceTemp: 32,
      boilTemp: 212,
      boilBaseline: 208,
      name: 'RIMS Tube',
      useSetpointAdjust: false
    },
    thermistor3: {
      expanded: false,
      iceTemp: 32,
      boilTemp: 212,
      boilBaseline: 208,
      name: 'Mash Tun',
      useSetpointAdjust: false
    }
  },
  rims: {
    proportional: 50,
    integral: 100,
    derivative: 100,
    maxOutput: 80,
    setpointAdjust: 0
  },
  boil: {
    setpoint: 60
  }
}

export default (state = initialState, action) => {
  switch(action.type){
    case SETTINGS:
    case HEATER_SETTINGS:
    case TEMP_SETTINGS:
    case THERMISTOR_SETTINGS:
      return {
        ...state,
        ...cloneDeep(action.payload)
      }
    case CHART_WINDOW:
      var newState = cloneDeep(state)
      newState.temperatures.chartWindow = action.payload
      return newState
    default:
      return state;
  }
}
