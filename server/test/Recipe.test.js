const assert = require('assert')
const { expect } = require('chai')
const Recipe = require('../service/Recipe')

describe('Recipe Creation', function() {
  describe('getting and setting time variables', () => {
    var recipe = new Recipe()
    it('totalTime returns 00:00:00', () => {
      assert.equal(recipe.totalTime.toString(), '00:00:00')
    })
    it('stepTime returns 00:00:00', () => {
      assert.equal(recipe.stepTime.toString(), '00:00:00')
    })
    it('remainingTime returns 00:00:00', () => {
      assert.equal(recipe.remainingTime.toString(), '00:00:00')
    })
    it('totalTime returns 00:00:05 (toString)', () => {
      recipe.totalTime = 5
      assert.equal(recipe.totalTime.toString(), '00:00:05')
    })
    it('stepTime returns 00:00:05 (toString)', () => {
      recipe.stepTime = 5
      assert.equal(recipe.stepTime.toString(), '00:00:05')
    })
    it('remainingTime returns 00:00:05 (toString)', () => {
      recipe.remainingTime = 5
      assert.equal(recipe.remainingTime.toString(), '00:00:05')
    })
    it('totalTime returns 01:00:05 (toString)', () => {
      recipe.totalTime = 3605
      assert.equal(recipe.totalTime.toString(), '01:00:05')
    })
    it('stepTime returns 01:00:05 (toString)', () => {
      recipe.stepTime = 3605
      assert.equal(recipe.stepTime.toString(), '01:00:05')
    })
    it('remainingTime returns 01:00:05 (toString)', () => {
      recipe.remainingTime = 3605
      assert.equal(recipe.remainingTime.toString(), '01:00:05')
    })
    it('totalTime returns 5 (value)', () => {
      recipe.totalTime = 5
      assert.equal(recipe.totalTime.value(), 5)
    })
    it('stepTime returns 5 (value)', () => {
      recipe.stepTime = 5
      assert.equal(recipe.stepTime.value(), 5)
    })
    it('remainingTime returns 5 (value)', () => {
      recipe.remainingTime = 5
      assert.equal(recipe.remainingTime.value(), 5)
    })
    it('reset time sets totalTime back to 00:00:00', () => {
      recipe.resetTime()
      assert.equal(recipe.totalTime.toString(), '00:00:00')
      assert.equal(recipe.stepTime.toString(), '00:00:00')
      assert.equal(recipe.remainingTime.toString(), '00:00:00')
    })
  })
  describe('recipe steps', () => {
    it('recipe returns {}', () => {
      var recipe = new Recipe()
      expect(recipe.value).to.deep.equal({})
    })
    it('recipe returns initialized recipe', () => {
      var recipeObject = require('./storeCopy.json')
      var recipe = new Recipe(recipeObject)
      expect(recipe.value).to.deep.equal(recipeObject)
    })
  })
})