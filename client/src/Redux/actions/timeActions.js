import {
  UPDATE_TIME
} from '../types'

export const updateTime = (time) => {
  return {
    type: UPDATE_TIME,
    payload: time
  }
}
