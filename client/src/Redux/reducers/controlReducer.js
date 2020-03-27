import {
  UPDATE_OUTPUT,
  UPDATE_LIVE_OUTPUT
} from '../types'
import { findIndex } from 'lodash'

const initialState = [
  {
    name: 'Pump1',
    displayName: 'Pump 1',
    value: 0,
    liveValue: 0
  },
  {
    name: 'Pump2',
    displayName: 'Pump 2',
    value: 0,
    liveValue: 0
  },
  {
    name: 'Heat1',
    displayName: 'RIMS Tube Element',
    value: 0,
    liveValue: 0
  },
  {
    name: 'Heat2',
    displayName: 'Boil Kettle Element',
    value: 0,
    liveValue: 0
  },
  {
    name: 'Contactor1',
    displayName: 'Contactor 1',
    value: 0,
    liveValue: 0
  },
  {
    name: 'Contactor2',
    displayName: 'Contactor 2',
    value: 0,
    liveValue: 0
  }
]

export default (state = initialState, action) => {
  const { type, payload, index } = action
  switch(type) {
    case UPDATE_OUTPUT:
      var newState = [ ...state ]
      newState[index].value = payload
      return newState
    case UPDATE_LIVE_OUTPUT:
      var newState = [ ...state ]
      var valueIndex = findIndex(newState, { name: payload.name })
      newState.splice(index, 1, { ...newState[valueIndex], ...payload })
      return newState
    default:
      return state;
  }
}
