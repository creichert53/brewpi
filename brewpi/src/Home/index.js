import React from 'react'
import { connect } from 'react-redux'

import PropTypes from 'prop-types'
import classnames from 'classnames'
import { withStyles } from '@material-ui/core/styles'
import Card from '@material-ui/core/Card'
import Button from '@material-ui/core/Button'
import CardHeader from '@material-ui/core/CardHeader'
import Checkbox from '@material-ui/core/Checkbox'
import Divider from '@material-ui/core/Divider'
import EventNoteIcon from '@material-ui/icons/EventNote'
import FormControl from '@material-ui/core/FormControl'
import FormGroup from '@material-ui/core/FormGroup'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Grid from '@material-ui/core/Grid'
import Icon from '@material-ui/core/Icon'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import ListSubheader from '@material-ui/core/ListSubheader'
import MenuItem from '@material-ui/core/MenuItem'
import MenuList from '@material-ui/core/MenuList'
import LinearProgress from '@material-ui/core/LinearProgress'
import PersonIcon from '@material-ui/icons/Person'
import PersonOutlineIcon from '@material-ui/icons/PersonOutline'
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline'
import Popover from '@material-ui/core/Popover'
import Stepper from '@material-ui/core/Stepper'
import Step from '@material-ui/core/Step'
import StepLabel from '@material-ui/core/StepLabel'
import StepContent from '@material-ui/core/StepContent'
import TimerIcon from '@material-ui/icons/Timer'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'

import findIndex from 'lodash/findIndex'
import isEqual from 'lodash/isEqual'

import gradient from 'gradient-color'
import numeral from 'numeral'
import timeFormat from '../helpers/hhmmss.js'
import convert from 'convert-units'
import color from 'color'
import { completeStep, startBrew, updateChartWindow } from '../Redux/actions'

import * as BreweryIcons from '../assets/components/BreweryIcons'
import TempChart from './TempChart'

const styles = theme => ({
  root: {
    flexGrow: 1,
  },
  button: {
    marginTop: theme.spacing.unit,
    marginRight: theme.spacing.unit,
    marginBottom: theme.spacing.unit,
  },
  startButton: {
    marginRight: 'auto',
    marginLeft: 'auto'
  },
  card: {
    padding: theme.spacing.unit * 2,
    color: theme.palette.text.secondary,
  },
  tempCard: {
    padding: theme.spacing.unit * 2,
    color: theme.palette.text.secondary,
    minWidth: 250,
    textAlign: 'center',
    fontSize: '125px'
  },
  largeFont: {
    fontSize: '100px'
  },
  ingredientCard: {
    paddingTop: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit * 2,
  },
  icon: {
    margin: theme.spacing.unit,
    fontSize: 32,
  },
  setpointMark: {
    float: 'right',
    position: 'relative',
    right: '50%',
    marginTop: -10,
    dropShadow: theme.shadows[10]
  },
  setpointText: {
    paddingLeft: theme.spacing.unit * 2,
    paddingRight: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit
  },
  row: {
    display: 'table',
    width: '100%',
    tableLayout: 'fixed',
    borderSpacing: '10px'
  },
  column: {
    display: 'table-cell'
  },
  leftIcon: {
    marginRight: theme.spacing.unit,
  },
  cornerColor: {
    float: 'right',
    content: '',
    borderTop: '15px solid',
    borderLeft: '15px solid transparent',
    top: 0,
    right: 0
  }
})

class Home extends React.Component {
  state = {
    chartWindowAnchorEl: null,
  }

  handleChartWindowSelectClick = event => {
    this.setState({ chartWindowAnchorEl: event.currentTarget });
  }
  handleChartWindowSelectClose = (value) => {
    if (value) this.props.updateChartWindow(value)
    this.setState({ chartWindowAnchorEl: null });
  }

  complete = (payload, time) => {
    this.props.completeStep(payload, time)
  }

  render() {
    const { theme, classes, elements, recipe, settings, steps, temps, tempArray, time, startBrew } = this.props
    const { chartWindowAnchorEl } = this.state

    const srm = gradient(theme.colors.srmBeersmith, theme.colors.srmBeersmith.length * 10)
    const recipeColor = srm[Math.min(numeral(recipe.est_color).value() * 10, theme.colors.srmBeersmith.length * 10 - 1)]
    const boilTime = recipe.boil_time ? timeFormat.fromS(recipe.boil_time * 60) : timeFormat.fromS(0)
    const boilTimeParts = boilTime.split(':')
    const activeStep = (steps && findIndex(steps, step => !step.complete))

    // Determine Temp Values
    var temperatures = Object.values(temps)
    const tempKeys = Object.keys(settings.temperatures).reduce((acc,val) => {
      if (val.indexOf('thermistor') === 0) acc.push(settings.temperatures[val])
      return acc
    }, [])
    temperatures = temperatures.map((v,i) => {
      return {
        ...tempKeys[i],
        setpoint: recipe.activeStep ? recipe.activeStep.setpoint : null,
        color: theme.colors.graph[`temp${String(i+1)}`],
        temperature: v
      }
    }).filter(t => t.temperature !== null)

    return (
      <div>
        <Grid container spacing={24} direction='column'>
          <Grid item>
            <Grid container spacing={24}>
              {temperatures.map((v,i) => {
                v.setpointAdjusted = v.useSetpointAdjust
                  ? recipe.activeStep && recipe.activeStep.setpoint + settings.rims.setpointAdjust
                  : recipe.activeStep && recipe.activeStep.setpoint
                v.progress = (Math.max(Math.min(v.temperature - v.setpointAdjusted, 10), -10) + 10) / 20 * 100
                v.setpointBar = ((recipe.activeStep && recipe.activeStep.title === 'Heat Strike Water') ||
                  (recipe.activeStep && recipe.activeStep.title === 'Heat Sparge Water'))
                  ? true
                  : false
                return (
                  <Grid key={i} item xs={12} md={12 / temperatures.length} >
                    <Card>
                      <span className={classes.cornerColor} style={{ borderTopColor: v.color }}/>
                      <div className={classes.tempCard}>
                        {v.temperature.toFixed(1)}
                      </div>
                      <div className={classes.row} >
                        <div className={classes.column}>
                          <Typography variant='h6' className={classes.setpointText}>
                            {v.setpointAdjusted > 0 ? `${numeral(v.setpointAdjusted).format('0.0')} °F` : ''}
                          </Typography>
                        </div>
                        <div className={classes.column}>
                          <Typography variant='h5' style={{ textAlign: 'center' }}>
                            {v.name}
                          </Typography>
                        </div>
                        <div className={classes.column}>
                          <Typography variant='h6' className={classes.setpointText} align='right'>
                            {v.name.indexOf('RIMS') > -1
                              ? `${numeral(elements.rims).format('0.0')} %`
                              : ''}
                          </Typography>
                        </div>
                      </div>
                      <div style={v.setpointAdjusted > 0 ? {} : { display: 'none' }}>
                        <LinearProgress variant='determinate' value={v.progress} />
                        <svg width='2' height='10' className={classes.setpointMark}>
                          <rect width='2' height='10' style={{ fill: theme.palette.secondary.main }} />
                        </svg>
                      </div>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          </Grid>
          {!isEqual(tempArray, []) && <Grid item>
            <Grid container spacing={24}>
              <Grid item xs={12}>
                <Card className={classes.card}>
                  <CardHeader
                    action={
                      <Button
                        variant='outlined'
                        className={classes.button}
                        aria-owns={chartWindowAnchorEl ? 'chart-window-menu' : null}
                        aria-haspopup='true'
                        onClick={this.handleChartWindowSelectClick}
                      >
                        <TimerIcon className={classes.leftIcon}/>
                        Window
                      </Button>
                    }
                    title={<Typography gutterBottom style={{ marginRight: theme.spacing.unit * 3 }} align='right' variant='h6'>
                      {`${settings.temperatures.chartWindow} mins`}
                    </Typography>}
                  />
                  <Popover
                    id='chart-window-menu'
                    anchorEl={chartWindowAnchorEl}
                    open={Boolean(chartWindowAnchorEl)}
                    onClose={() => this.handleChartWindowSelectClose(null)}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                  >
                    <MenuList>
                      <MenuItem onClick={() => this.handleChartWindowSelectClose(5)}>5 minutes</MenuItem>
                      <MenuItem onClick={() => this.handleChartWindowSelectClose(10)}>10 minutes</MenuItem>
                      <MenuItem onClick={() => this.handleChartWindowSelectClose(30)}>30 minutes</MenuItem>
                    </MenuList>
                  </Popover>
                  <TempChart />
                </Card>
              </Grid>
            </Grid>
          </Grid>}
          <Grid item>
            <Grid container spacing={24}>
              <Grid item xs={12} sm={6}>
                <Grid container spacing={24} direction='column'>
                  <Grid item>
                    <Card className={classes.card}>
                      <List subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Recipe</ListSubheader>}>
                        <ListItem style={recipe.name ? {} : { display:'none' }}>
                          <ListItemIcon><EventNoteIcon /></ListItemIcon>
                          <ListItemText primary={recipe.name || 'Recipe Name'} />
                        </ListItem>
                        <Tooltip id='tooltip-brewer' title='Brewer' placement='top-start'>
                          <ListItem style={recipe.brewer ? {} : { display:'none' }}>
                            <ListItemIcon><PersonIcon /></ListItemIcon>
                            <ListItemText primary={recipe.brewer || 'Brewer'} />
                          </ListItem>
                        </Tooltip>
                        <Tooltip id='tooltip-assistant-brewer' title='Assistant Brewery' placement='top-start'>
                          <ListItem style={recipe.asst_brewer ? {} : { display:'none' }}>
                            <ListItemIcon><PersonOutlineIcon/></ListItemIcon>
                            <ListItemText primary={recipe.asst_brewer || 'Assistant Brewer'} />
                          </ListItem>
                        </Tooltip>
                        <Tooltip id='tooltip-batch-size' title='Batch Size' placement='top-start'>
                          <ListItem style={recipe.batch_size ? {} : { display:'none' }}>
                            <ListItemIcon style={{ marginLeft: 3 }}><Icon className='fas fa-beer'></Icon></ListItemIcon>
                            <ListItemText style={{ marginLeft: -1 }} primary={
                              recipe.batch_size ? `${numeral(convert(recipe.batch_size).from('l').to('gal')).format('0.0')} gal` : ''
                            } />
                          </ListItem>
                        </Tooltip>
                        <Tooltip id='tooltip-boil-time' title='Boil Time' placement='top-start'>
                          <ListItem style={recipe.boil_time ? {} : { display:'none' }}>
                            <ListItemIcon><TimerIcon /></ListItemIcon>
                            <ListItemText primary={
                              (boilTimeParts[0] > 0 ? `${numeral(boilTimeParts[0]).value()} hour ` : '') +
                              (boilTimeParts[1] > 0 ? `${numeral(boilTimeParts[1]).value()} minutes ` : '')
                            } />
                          </ListItem>
                        </Tooltip>
                        <ListItem style={recipe.est_color ? {
                          textAlign: 'center',
                          marginTop: 20,
                          backgroundColor: recipeColor,
                          height: 60
                        } : { display:'none' }}>
                          <Typography variant='subtitle1' gutterBottom style={{
                            paddingTop: 10,
                            width: '100%',
                            color: color(recipeColor).isLight() ? '#000' : '#fff'
                          }}>
                            {recipe.est_color}
                          </Typography>
                        </ListItem>
                      </List>
                    </Card>
                  </Grid>
                  <Grid item>
                    <Card className={classes.card}>
                      <List subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Steps</ListSubheader>}>
                        {!recipe.startBrew && <Divider/>}
                        {!recipe.startBrew &&
                          <ListItem>
                            <Button
                              variant='contained'
                              color='primary'
                              className={classnames(classes.button, classes.startButton)}
                              onClick={() => startBrew()}
                            >
                              Start Brew
                              <PlayCircleOutlineIcon className={classes.icon} />
                            </Button>
                          </ListItem>
                        }
                        {!recipe.startBrew && <Divider/>}
                        <Stepper
                          activeStep={activeStep}
                          orientation='vertical'
                        >
                          {steps ? steps.map((step, index) => {
                            return (
                              <Step key={step.id}>
                                <StepLabel>{step.title}</StepLabel>
                                <StepContent>
                                  {recipe.startBrew ? <Typography variant='subtitle2'>{step.content}</Typography> : null}
                                  {recipe.startBrew && step.todos ? (
                                    <FormControl component='fieldset'>
                                      <FormGroup style={{ padding: theme.spacing.unit * 2 }}>
                                        {step.todos.map((todo, index) => (
                                            <FormControlLabel
                                              key={todo.id}
                                              control={
                                                <Checkbox
                                                  checked={todo.complete}
                                                  onChange={() => this.complete({ id: todo.id, type: 'todo' }, time)}
                                                  value={todo.id}
                                                />
                                              }
                                              label={todo.step}
                                            />)
                                          )
                                        }
                                        <Button
                                          variant='contained'
                                          color='primary'
                                          onClick={() => this.complete({ id: step.id, type: 'step' }, time)}
                                          disabled={step.todos.filter(todo => !todo.complete).length > 0} // disabled if there are incomplete todos
                                          className={classes.button}
                                        >
                                          {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
                                        </Button>
                                      </FormGroup>
                                    </FormControl>
                                  ) : null}
                                </StepContent>
                              </Step>
                            )
                          }) : []}
                        </Stepper>
                      </List>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card className={classes.card}>
                  <List subheader={<ListSubheader component='div' style={{ textAlign: 'center' }}>Ingredients</ListSubheader>}>
                    <div style={{ height: theme.spacing.unit * 2 }}/>
                    {recipe.waters && <Divider/>}
                    {recipe.waters && <List subheader={<ListSubheader component='div'>Water</ListSubheader>}>
                      {recipe.waters && recipe.waters.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon><BreweryIcons.WaterIcon /></ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={ingredient.display_amount}/>
                        </ListItem>
                      ))}
                    </List>}
                    {recipe.miscs && <Divider />}
                    {recipe.miscs && <List subheader={<ListSubheader component='div'>Miscellaneous</ListSubheader>}>
                      {recipe.miscs && recipe.miscs.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon><BreweryIcons.MiscIcon /></ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={`${ingredient.type}: ${ingredient.display_amount}`}/>
                        </ListItem>
                      ))}
                    </List>}
                    {recipe.fermentables && <Divider />}
                    {recipe.fermentables && <List subheader={<ListSubheader component='div'>Fermentables</ListSubheader>}>
                      {recipe.fermentables && recipe.fermentables.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon>{ingredient.type === 'Grain' ? <BreweryIcons.MaltIcon /> : <BreweryIcons.TeaIcon />}</ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={`${ingredient.type}: ${ingredient.display_amount}`}/>
                        </ListItem>
                      ))}
                    </List>}
                    {recipe.hops && <Divider />}
                    {recipe.hops && <List subheader={<ListSubheader component='div'>Hops</ListSubheader>}>
                      {recipe.hops && recipe.hops.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon><BreweryIcons.HopIcon /></ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={`${ingredient.type}: ${ingredient.display_amount}`}/>
                        </ListItem>
                      ))}
                    </List>}
                    {recipe.yeasts && <Divider />}
                    {recipe.yeasts && <List subheader={<ListSubheader component='div'>Yeast</ListSubheader>}>
                      {recipe.yeasts && recipe.yeasts.map(ingredient => (
                        <ListItem key={ingredient.id}>
                          <ListItemIcon><BreweryIcons.YeastIcon /></ListItemIcon>
                          <ListItemText primary={ingredient.name} secondary={`${ingredient.type}: ${ingredient.display_amount}`}/>
                        </ListItem>
                      ))}
                    </List>}
                    <Divider />
                  </List>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </div>
    )
  }
}

Home.propTypes = {
  classes: PropTypes.object.isRequired,
}

const mapStateToProps = (state) => ({
  elements: state.elements,
  recipe: state.recipe,
  steps: state.recipe.steps,
  temps: state.temperatures,
  tempArray: state.temperatureArray,
  settings: state.settings,
  time: state.time
})

export default withStyles(styles, { withTheme: true })(connect(mapStateToProps, {
  completeStep,
  startBrew,
  updateChartWindow
})(Home))
