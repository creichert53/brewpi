import {
  NEW_RECIPE,
  UPDATE_RECIPE,
  COMPLETE_STEP,
  COMPLETE_TODO,
  START_BREW,
  UPDATE_SNACKBAR_MESSAGE
} from '../types'

export default (state = {}, action) => {
  switch(action.type) {
    case UPDATE_RECIPE:
      return action.payload // entire updated recipe from server
    case NEW_RECIPE:
      return action.payload // if importing a new recipe, always replace old recipe
    case COMPLETE_STEP:
      return action.payload // payload is the existing recipe -> send to server -> update STEP on server -> send recipe to UPDATE_RECIPE
    case COMPLETE_TODO:
      return action.payload // payload is the existing recipe -> send to server -> update TODO on server -> send to UPDATE_RECIPE
    case START_BREW:
      return action.payload
    case UPDATE_SNACKBAR_MESSAGE:
      return action.payload
    default:
      return state
  }
}
