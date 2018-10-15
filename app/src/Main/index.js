/** REACT-REDUX **/
import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'

/** REACT-ROUTER **/
import { Route, withRouter } from 'react-router-dom'

/** MATERIAL-UI **/
import { withStyles } from '@material-ui/core/styles'
import Drawer from '@material-ui/core/Drawer'
import AppBar from '@material-ui/core/AppBar'
import Toolbar from '@material-ui/core/Toolbar'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import Typography from '@material-ui/core/Typography'
import IconButton from '@material-ui/core/IconButton'
import Hidden from '@material-ui/core/Hidden'
import Divider from '@material-ui/core/Divider'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import MenuIcon from '@material-ui/icons/Menu'
import HomeIcon from '@material-ui/icons/Home'
import SettingsIcon from '@material-ui/icons/Settings'
import AccountCircle from '@material-ui/icons/AccountCircle'
import FileUpload from '@material-ui/icons/FileUpload'

import classnames from 'classnames'

import xml2js, { parseString } from 'xml2js'

import Home from '../Home'
import Settings from '../Settings'
import { formatRecipe, newRecipe } from '../Redux/actions'

const styles = theme => ({
  root: {
    flexGrow: 1,
    height: '100%',
    zIndex: 1,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    width: '100%',
  },
  appBar: {
    position: 'absolute',
    backgroundColor: theme.colors.palette[0],
    marginLeft: theme.drawerWidth,
    [theme.breakpoints.up('md')]: {
      width: `calc(100% - ${theme.drawerWidth}px)`,
    },
    [theme.breakpoints.down('sm')]: {
      marginLeft: 0,
    },
  },
  navIconHide: {
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  },
  toolbar: theme.mixins.toolbar,
  drawerPaper: {
    width: theme.drawerWidth,
    [theme.breakpoints.up('md')]: {
      position: 'relative',
    },
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.unit * 3,
    overflowY: 'scroll'
  },
  drawerContent: {
    height: '100%',
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0
  },
  drawerContent1: {
    /* The image used */
    backgroundImage: `url(${require('../assets/drawer_background.jpg')})`,

    /* Center and scale the image nicely */
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  },
  drawerContent2: {
    backgroundColor: 'white',
    opacity: 0.7,
  },
  menuButton: {
    marginLeft: -12,
    marginRight: 20,
  },
  input: {
    display: 'none',
  },
  list: {
    backgroundColor: 'rgb(145, 145, 145, 0.25)'
  }
})

const routes = [
  {
    path: '/',
    component: Home,
    icon: HomeIcon,
    text: 'Home'
  },
  {
    path: '/settings',
    component: Settings,
    icon: SettingsIcon,
    text: 'Settings'
  }
]

// wrap <Route> and use this everywhere instead, then when
// sub routes are added to any route it'll work
const RouteWithSubRoutes = route => (
  <Route
    path={route.path}
    render={props => (
      // pass the sub-routes down to keep nesting
      <route.component {...props} {...route} routes={route.routes} />
    )}
  />
)
const DrawerListWithRoutes = props => (
  <ListItem button onClick={() => props.push(props.path)}>
    {props.icon ? <ListItemIcon style={{...props.style}}><props.icon /></ListItemIcon> : null}
    <Typography style={{...props.style}} variant='subheading'>
      {props.text}
    </Typography>
    {/* <ListItemText style={{...props.style}} primary={props.text} /> */}
  </ListItem>
)

class ResponsiveDrawer extends React.Component {
  state = {
    mobileOpen: false,
    anchorEl: null,
  }

  handleDrawerToggle = () => {
    this.setState({ mobileOpen: !this.state.mobileOpen })
  }

  handleChange = (event, checked) => {
    this.setState({ auth: checked });
  }

  handleMenu = event => {
    this.setState({ anchorEl: event.currentTarget });
  }

  handleClose = () => {
    this.setState({ anchorEl: null });
  }

  handleFile = (selectorFiles: FileList) => {
    const file = selectorFiles[0]
    const that = this
    if (file) {
      var reader = new FileReader();
      reader.readAsText(file, 'UTF-8');
      reader.onload = function (evt) {
        const xml = evt.target.result
        parseString(xml, {
          trim: true,
          normalize: true,
          normalizeTags: true,
          explicitArray: false,
          preserveChildrenOrder: true,
          valueProcessors: [ xml2js.processors.parseNumbers, xml2js.processors.parseBooleans ],
        }, function (err, result) {
          const r = formatRecipe(result.recipes.recipe)
          that.props.newRecipe(r)
        })
      }
      reader.onerror = function (evt) {
        console.log('error reading file')
      }
    }
  }

  render() {
    const { classes, theme, history, location, time } = this.props
    const { anchorEl } = this.state
    const open = Boolean(anchorEl)

    const drawer = (
      <div className={classnames(classes.drawerContent, classes.drawerContent1)}>
        <div className={classnames(classes.drawerContent, classes.drawerContent2)} />
        <div className={classes.drawerContent}>
          <div style={{padding:'10px',textAlign:'center',paddingBottom:'50px'}}>
            <div style={theme.typography.titleFont}>Reichert Home Brewery</div>
          </div>
          <Divider />
          <List className={classes.list}>
            {routes.map((route, i) =>
              <DrawerListWithRoutes
                {...route}
                {...history}
                key={i}
                style={location.pathname === route.path ? { color: theme.colors.palette[0] } : { color: 'rgb(100, 100, 100)' }}
              />)}
          </List>
          <Divider />
        </div>
      </div>
    )

    return (
      <div className={classes.root}>
        <AppBar className={classes.appBar} position='static'>
          <Toolbar>
            <IconButton
              color='inherit'
              aria-label='open drawer'
              onClick={this.handleDrawerToggle}
              className={classes.navIconHide}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant='title' color='inherit' noWrap style={{ flex:1 }}>
              {routes.filter(x => x.path === location.pathname).map((route, i) => route.text)}
            </Typography>
            <Typography variant='title' color='inherit' noWrap>
              {time.totalTime}
            </Typography>
            <div>

              {/* XML Input */}
              <input
                accept='text/xml'
                className={classes.input}
                id='upload-beer-xml'
                type='file'
                onChange={ (e) => this.handleFile(e.target.files) }
              />
              {/* Upload recipe */}
              <label htmlFor='upload-beer-xml'>
                <IconButton color='inherit' component='span'>
                  <FileUpload />
                </IconButton>
              </label>

              {/* Profile */}
              <IconButton
                aria-owns={open ? 'menu-appbar' : null}
                aria-haspopup='true'
                onClick={this.handleMenu}
                color='inherit'
              >
                <AccountCircle />
              </IconButton>

              {/* Profile Menu */}
              <Menu
                id='menu-appbar'
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={open}
                onClose={this.handleClose}
              >
                <MenuItem onClick={this.handleClose}>Profile</MenuItem>
                <MenuItem onClick={this.handleClose}>My account</MenuItem>
              </Menu>

            </div>
          </Toolbar>
        </AppBar>
        <Hidden mdUp>
          <Drawer
            variant='temporary'
            anchor={theme.direction === 'rtl' ? 'right' : 'left'}
            open={this.state.mobileOpen}
            onClose={this.handleDrawerToggle}
            classes={{
              paper: classes.drawerPaper,
            }}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
          >
            {drawer}
          </Drawer>
        </Hidden>
        <Hidden smDown implementation='css'>
          <Drawer
            variant='permanent'
            open
            classes={{
              paper: classes.drawerPaper,
            }}
          >
            {drawer}
          </Drawer>
        </Hidden>
        <main className={classes.content}>
          <div className={classes.toolbar} />
          {routes.filter(x => x.path === location.pathname).map((route, i) => <RouteWithSubRoutes key={i} {...route} />)}
        </main>
      </div>
    )
  }
}

ResponsiveDrawer.propTypes = {
  classes: PropTypes.object.isRequired,
  theme: PropTypes.object.isRequired,
}

const mapStateToProps = (state) => ({
  time: state.time
})

export default withStyles(styles, { withTheme: true })(withRouter(connect(mapStateToProps, {
  newRecipe
})(ResponsiveDrawer)))
