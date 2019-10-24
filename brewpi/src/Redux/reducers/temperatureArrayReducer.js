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
      console.log(state)
      return takeRight(cloneDeep(state).concat(typeof action.payload === 'array' ? action.payload : [action.payload]), 30 * 60)
    default:
      return state;
  }
}
