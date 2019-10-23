const _ = require('lodash')
const r = require('rethinkdb')

function Temperatures() {
  // keep track of the recipe
  this.recipeId = null
  this.setRecipeId = (recipeId) => {
    console.log(recipeId)
    this.recipeId = recipeId
  }
  this.value = {
    temp1: null,
    temp2: null,
    temp3: null
  }

  // record a new temperature in the database
  this.addTemp = (stepId, timeInSeconds) => {
    if (this.recipeId && Object.values(this.value).reduce((acc,val) => acc += val === null ? 1 : 0, 0) !== 3) {
      r.connect({db: 'brewery'}).then(conn => {
        r.table('temperatures').insert({
          stepId: stepId,
          recipeId: this.recipeId,
          time: moment().add(500, 'ms').startOf('second').unix(),
          brewTime: timeInSeconds,
          complete: false,
          ...this.value
        }).run(conn).finally(() => {
          conn.close()
        })
      })
    }
  }
}