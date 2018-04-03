import { NEW_RECIPE } from '../types'

export const newRecipe = (recipe) => {
  return {
    type: NEW_RECIPE,
    payload: recipe
  }
}
