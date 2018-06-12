import {
  NEW_RECIPE,
  COMPLETE_STEP
} from '../types'
import traverse from 'traverse'

const completeStep = (state, payload) => {
  traverse(state).forEach(function(val) {
    if (val && typeof val === 'object' && val.id && val.id === payload.id) {
      this.update({
        ...val,
        complete: true
      })
    }
  })

  // set the active step
  if (payload.type === 'step') {
    const incompleteSteps = state.steps.filter(step => !step.complete)
    state.activeStep = incompleteSteps.length > 0 ? incompleteSteps[0] : {
      complete: true
    }
  }

  return state
}

export default (state = {}, action) => {
  switch(action.type){
    case NEW_RECIPE:
      return action.payload // if importing a new recipe, always replace old recipe
    case COMPLETE_STEP:
      return completeStep({ ...state }, action.payload) // payload is id of step to update
    default:
      return state;
  }
}
