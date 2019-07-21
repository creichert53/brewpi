import {
  NEW_RECIPE,
  COMPLETE_STEP,
  START_BREW,
  ADD_INGREDIENT
} from '../types'

export default (state = {}, action) => {
  switch(action.type) {
    case NEW_RECIPE:
      return action.payload // if importing a new recipe, always replace old recipe
    case COMPLETE_STEP:
      return action.payload // payload is the updated recipe
    case START_BREW:
      return action.payload
    case ADD_INGREDIENT:
      return action.payload
    default:
      return state
  }
}
