import {
  TEMPERATURE,
  TEMPERATURES
} from '../types'

const initialState = {
  temp1: null,
  temp2: null,
  temp3: null
}

export default (state = initialState, action) => {
  switch(action.type){
    case TEMPERATURE:
      return {
        ...state,
        [action.payload.id]: action.payload.value
      }
    case TEMPERATURES:
      return {
        ...state,
        ...action.payload
      }
    default:
      return state;
  }
}
