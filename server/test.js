const Recipe = require('./service/Recipe')

const recipe = new Recipe()

// const ProgressPromise = require('progress-promise')

// function longTask() {
//   return new ProgressPromise((resolve, reject, progress) => {
//     setTimeout(() => progress({
//       time: 0,
//       count: 0
//     }), 250);
//     setTimeout(() => progress({
//       time: 1,
//       count: 1
//     }), 500);
//     setTimeout(() => progress({
//       time: 2,
//       count: 2
//     }), 750);
//     setTimeout(resolve, 1000);
//   })
// }

// longTask()
//   .progress(console.log)
//   .then(() => console.log('finished'))