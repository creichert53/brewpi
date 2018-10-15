import _ from 'lodash'
import numeral from 'numeral'

import {
  SETTINGS,
  HEATER_SETTINGS,
  TEMP_SETTINGS,
  THERMISTOR_SETTINGS,
} from '../types'

const initialState = {
  temperatures: {
    logTemperatures: false,
    mashTempInterval: 1,
    boilTempInterval: 30,
    thermistor1: {
      expanded: false,
      iceTemp: 32,
      boilTemp: 212,
      boilBaseline: 208,
      name: 'Hot Liquor Tank'
    },
    thermistor2: {
      expanded: false,
      iceTemp: 32,
      boilTemp: 212,
      boilBaseline: 208,
      name: 'RIMS Tube'
    },
    thermistor3: {
      expanded: false,
      iceTemp: 32,
      boilTemp: 212,
      boilBaseline: 208,
      name: 'Mash Tun'
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
        ..._.cloneDeep(action.payload)
      }
    default:
      return state;
  }
}
