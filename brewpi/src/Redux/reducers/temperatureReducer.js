import {
  UPDATE_TEMPERATURE
} from '../types'

const initialState = {
  temp1: 0,
  temp2: 0,
  temp3: 0
}

export default (state = initialState, action) => {
  switch(action.type){
    case UPDATE_TEMPERATURE:
      return {
        ...action.payload
      }
    default:
      return state;
  }
}
