import {
  UPDATE_OUTPUT
} from '../types'

export const updateOutput = (index, value) => {
  return {
    type: UPDATE_OUTPUT,
    payload: value,
    index: index
  }
}
