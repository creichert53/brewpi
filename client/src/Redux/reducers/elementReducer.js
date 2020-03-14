import {
  UPDATE_ELEMENTS
} from '../types'

const initialState = {
  rims: 0.0,
  boil: 0.0
}

export default (state = initialState, action) => {
  switch(action.type) {
    case UPDATE_ELEMENTS:
      return action.payload
    default:
      return state;
  }
}
