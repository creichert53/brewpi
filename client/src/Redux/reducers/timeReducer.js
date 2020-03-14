import cloneDeep from 'lodash/cloneDeep'

import {
  UPDATE_TIME
} from '../types'

const initialState = {
  totalTime: '00:00:00',
  stepTime: '00:00:00',
  remainingTime: null
}

export default (state = initialState, action) => {
  switch(action.type){
    case UPDATE_TIME:
      return {
        ...state,
        ...cloneDeep(action.payload)
      }
    default:
      return state;
  }
}
