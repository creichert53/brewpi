import { NEW_RECIPE } from '../types'

export default (state = {}, action) => {
  switch(action.type){
    case NEW_RECIPE:
      return action.payload // if importing a new recipe, always replace old recipe
    default:
      return state;
  }
}
