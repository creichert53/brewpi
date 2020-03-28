const assert = require('assert')
const { expect } = require('chai')
const mockRecipe = require('./recipe.json')
const Recipe = require('../service/Recipe')

process.setMaxListeners(30)
const newRecipe = () => {
  var recipe = new Recipe(mockRecipe)
  var step = recipe.currentStep
  return { recipe, step }
}
describe('Recipe', function() {
  const { recipe, step } = newRecipe()
  describe('getting and setting time variables', () => {
    it('totalTime returns 00:00:00', () => {
      assert.equal(recipe.totalTime.toString(), '00:00:00')
    })
    it('stepTime returns 00:00:00', () => {
      assert.equal(step.stepTime.toString(), '00:00:00')
    })
    it('remainingTime returns 00:00:00', () => {
      assert.equal(step.remainingTime.toString(), '00:00:00')
    })
    it('totalTime returns 00:00:05 (toString)', () => {
      recipe.totalTime = 5
      assert.equal(recipe.totalTime.toString(), '00:00:05')
    })
    it('stepTime returns 00:00:05 (toString)', () => {
      step.stepTime = 5
      assert.equal(step.stepTime.toString(), '00:00:05')
    })
    it('remainingTime returns 00:00:05 (toString)', () => {
      step.remainingTime = 5
      assert.equal(step.remainingTime.toString(), '00:00:05')
    })
    it('totalTime returns 01:00:05 (toString)', () => {
      recipe.totalTime = 3605
      assert.equal(recipe.totalTime.toString(), '01:00:05')
    })
    it('stepTime returns 01:00:05 (toString)', () => {
      step.stepTime = 3605
      assert.equal(step.stepTime.toString(), '01:00:05')
    })
    it('remainingTime returns 01:00:05 (toString)', () => {
      step.remainingTime = 3605
      assert.equal(step.remainingTime.toString(), '01:00:05')
    })
    it('totalTime returns 5 (value)', () => {
      recipe.totalTime = 5
      assert.equal(recipe.totalTime.value(), 5)
    })
    it('stepTime returns 5 (value)', () => {
      step.stepTime = 5
      assert.equal(step.stepTime.value(), 5)
    })
    it('remainingTime returns 5 (value)', () => {
      step.remainingTime = 5
      assert.equal(step.remainingTime.value(), 5)
    })
    it('reset time (Recipe) sets totalTime back to 00:00:00', () => {
      recipe.resetTotalTime()
      assert.equal(recipe.totalTime.toString(), '00:00:00')
    })
    it('reset time (Step) sets stepTime and remainingTime back to 00:00:00', () => {
      step.resetTotalTime()
      assert.equal(step.stepTime.toString(), '00:00:00')
      assert.equal(step.remainingTime.toString(), '00:00:00')
    })
  })
  describe('recipe steps', () => {
    it('recipe returns {}', () => {
      var unitRecipe = new Recipe()
      expect(unitRecipe.value).to.deep.equal(false)
      unitRecipe.end()
    })
    it('recipe returns initialized recipe', () => {
      expect(recipe.value).to.deep.equal(mockRecipe)
    })
    it('expect the first step id to be "1ceca2d1-bfbe-4115-af91-2c95ca5699cc"', () => {
      expect(recipe.currentStep.id).to.equal('1ceca2d1-bfbe-4115-af91-2c95ca5699cc')
    })
    it('after completing a step, it should go to second step with id "46f14562-06db-4755-9c65-12c01eff1311"', () => {
      recipe.currentStep.complete()
      expect(recipe.currentStep.id).to.equal('46f14562-06db-4755-9c65-12c01eff1311')
    })
  })
  
  setTimeout(() => {
    console.log('Ending recipe...')
    recipe.end()
  }, 1000)
})