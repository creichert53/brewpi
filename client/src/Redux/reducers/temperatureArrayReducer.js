import {
  UPDATE_TEMPERATURE_ARRAY,
  CLEAR_TEMPERATURE_ARRAY
} from '../types'
import {
  cloneDeep,
  takeRight
} from 'lodash'

const initialState = []

export default (state = initialState, action) => {
  switch(action.type){
    case CLEAR_TEMPERATURE_ARRAY:
      return initialState
    case UPDATE_TEMPERATURE_ARRAY:
      // Return the 30 most recent minutes of data
      return takeRight(cloneDeep(state).concat(Array.isArray(action.payload) ? action.payload : [action.payload]), 30 * 60)
    default:
      return state;
  }
}
