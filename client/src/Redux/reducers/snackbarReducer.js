import {
  ENQUEUE_SNACKBAR,
  CLOSE_SNACKBAR,
  REMOVE_SNACKBAR,
  UPDATE_SNACKBARS
} from '../types'

export default (state = [], action) => {
  switch (action.type) {
    case UPDATE_SNACKBARS:
      return action.payload // entire notification array from server
    case ENQUEUE_SNACKBAR:
      return action.payload
    case CLOSE_SNACKBAR:
      return action.payload
    case REMOVE_SNACKBAR:
      return action.payload
    default:
      return state
  }
}
