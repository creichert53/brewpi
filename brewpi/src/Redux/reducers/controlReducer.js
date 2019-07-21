import {
  UPDATE_OUTPUT
} from '../types'

const initialState = [
  {
    name: 'pump1',
    displayName: 'Pump 1',
    value: 0
  },
  {
    name: 'pump2',
    displayName: 'Pump 2',
    value: 0
  },
  {
    name: 'heat1',
    displayName: 'RIMS Tube Element',
    value: 0
  },
  {
    name: 'heat2',
    displayName: 'Boil Kettle Element',
    value: 0
  },
  {
    name: 'contactor1',
    displayName: 'Contactor 1',
    value: 0
  },
  {
    name: 'contactor2',
    displayName: 'Contactor 2',
    value: 0
  },
]

export default (state = initialState, action) => {
  switch(action.type) {
    case UPDATE_OUTPUT:
      var newState = [ ...state ]
      newState[action.index].value = action.payload
      return newState
    default:
      return state;
  }
}
