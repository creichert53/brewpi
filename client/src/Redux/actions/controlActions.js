import {
  UPDATE_OUTPUT
} from '../types'

export const updateOutput = (index, name, value) => {
  return {
    type: UPDATE_OUTPUT,
    payload: value,
    name,
    index
  }
}
