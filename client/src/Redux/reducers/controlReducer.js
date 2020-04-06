import {
  UPDATE_OUTPUT,
  UPDATE_LIVE_OUTPUT
} from '../types'
import { findIndex, sortBy } from 'lodash'

const initialState = [
  {
    index: 0,
    name: 'Pump1',
    displayName: 'Pump 1',
    value: 0,
    liveValue: 0,
    timestamp: '2020-01-01 00:00:00'
  },
  {
    index: 1,
    name: 'Pump2',
    displayName: 'Pump 2',
    value: 0,
    liveValue: 0,
    timestamp: '2020-01-01 00:00:00'
  },
  {
    index: 2,
    name: 'Heat1',
    displayName: 'RIMS Tube Element',
    value: 0,
    liveValue: 0,
    timestamp: '2020-01-01 00:00:00'
  },
  {
    index: 3,
    name: 'Heat2',
    displayName: 'Boil Kettle Element',
    value: 0,
    liveValue: 0,
    timestamp: '2020-01-01 00:00:00'
  },
  {
    index: 4,
    name: 'Contactor1',
    displayName: 'Contactor 1',
    value: 0,
    liveValue: 0,
    timestamp: '2020-01-01 00:00:00'
  },
  {
    index: 5,
    name: 'Contactor2',
    displayName: 'Contactor 2',
    value: 0,
    liveValue: 0,
    timestamp: '2020-01-01 00:00:00'
  }
]

export default (state = initialState, action) => {
  const { type, payload, index } = action
  var newState
  switch(type) {
    case UPDATE_OUTPUT:
      newState = [ ...state ]
      newState[index].value = payload
      newState = sortBy(newState, 'index')
      return newState
    case UPDATE_LIVE_OUTPUT:
      newState = [ ...state ]
      var valueIndex = findIndex(newState, { name: payload.name })
      newState.splice(valueIndex, 1, { ...newState[valueIndex], ...payload })
      newState = sortBy(newState, ['index'])
      return newState
    default:
      return state;
  }
}
