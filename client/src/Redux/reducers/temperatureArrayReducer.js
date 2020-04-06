import {
  UPDATE_TEMPERATURE_ARRAY
} from '../types'
import {
  cloneDeep,
  takeRight
} from 'lodash'

const initialState = []

export default (state = initialState, action) => {
  switch(action.type){
    case UPDATE_TEMPERATURE_ARRAY:
      // Return the 30 most recent minutes of data
      // If the incoming data is already in array format, then use the array, otherwise concatenate the single value
      var newArray = Array.isArray(action.payload) ? action.payload : cloneDeep(state).concat([action.payload])
      return takeRight(newArray, 30 * 30)
    default:
      return state;
  }
}
