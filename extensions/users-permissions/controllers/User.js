'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
const moment = require('moment');
const bcrypt = require("bcryptjs")
const axios = require('axios')

const sanitizeUser = user =>
  sanitizeEntity(user, {
    model: strapi.query('user', 'users-permissions').model,
    includeFields: ['id', 'username', 'email', 'firstName', 'lastName', 'lastLoggin', 'data', 'role', 'avatar', 'provider']
  });

const formatError = error => [
  { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

module.exports = {
  async me(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.badRequest(null, [{ messages: [{ id: 'No authorization header was found' }] }]);
    }

    const userQuery = await strapi.query('user', 'users-permissions');
    const userWithMedia = await userQuery.findOne({ id: ctx.state.user.id });

    const data = sanitizeUser(userWithMedia, { model: userQuery.model });
    ctx.send(data);
  },
  async delete(ctx) {
    try {
      const token = await strapi.query('token').findOne({ id: ctx.params.id })
      if (token) {
        const user = await strapi.plugins['users-permissions'].services.user.fetch({ email: token.issueEmail });
        if (!user) {
          return ctx.notFound()
        }

        try {
          //update table token ActivatedDate
          await strapi.query('token').update({ id: token.id }, { validUntil: new Date().getTime(), activatedDate: new Date().getTime() })
        } catch (error) {

        }

        const data = await strapi.query('user', 'users-permissions').delete({ id: user.id });
        return ctx.send(data);
      }
      return ctx.notFound()
    } catch (error) {
      return ctx.badRequest(null, error);
    }
  },
  async updateMe(ctx) {
    const advancedConfigs = await strapi
      .store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
        key: 'advanced',
      })
      .get();

    const { id } = ctx.state.user;
    const { email, username, password } = ctx.request.body;

    if (_.has(ctx.request.body, 'email') && !email) {
      return ctx.badRequest('email.notNull');
    }

    if (_.has(ctx.request.body, 'username') && !username) {
      return ctx.badRequest('username.notNull');
    }

    if (_.has(ctx.request.body, 'password') && !password) {
      return ctx.badRequest('password.notNull');
    }

    if (_.has(ctx.request.body, 'username')) {
      const userWithSameUsername = await strapi
        .query('user', 'users-permissions')
        .findOne({ username });

      if (userWithSameUsername && userWithSameUsername.id != id) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.username.taken',
            message: 'username.alreadyTaken.',
            field: ['username'],
          })
        );
      }
    }

    if (_.has(ctx.request.body, 'email') && advancedConfigs.unique_email) {
      const userWithSameEmail = await strapi
        .query('user', 'users-permissions')
        .findOne({ email });

      if (userWithSameEmail && userWithSameEmail.id != id) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.email.taken',
            message: 'Email already taken',
            field: ['email'],
          })
        );
      }
    }

    const user = await strapi.plugins['users-permissions'].services.user.fetch({
      id,
    });

    let updateData = {
      ...ctx.request.body,
    };

    if (_.has(ctx.request.body, 'password') && password === user.password) {
      delete updateData.password;
    }
    const data = await strapi.plugins['users-permissions'].services.user.edit(
      { id },
      updateData
    );

    ctx.send(data);

    try {
    } catch (err) {
      ctx.send(err)
    }

  },
  async customChangePassword(ctx) {
    let param = ctx.request.body
    const user = ctx.state.user
    if (!user) return null

    const validatePassword = (password, hash) => bcrypt.compare(password, hash);
    const isValid = await validatePassword(param.oldpassword, user.password);
    if (isValid) {
      //  Generate new hash password
      const password = await strapi.plugins['users-permissions'].services.user.hashPassword({ password: param.password });
      // Update user password
      await strapi
        .query('user', 'users-permissions')
        .update({ id: user.id }, { resetPasswordToken: null, password });
      return { status: '200', message: "password-match" }
    } else {
      return { status: '404', message: "current-password-don't-match" }
    }

  },
  async customFindUser(ctx) {
    let entities
    let param = ctx.request.body
    let params = ctx.query
    const { type } = params
    const user = ctx.state.user
    if (!user) return null
    if (type) {
      switch (type) {
        case 'list':
          if (param) {
            entities = await strapi.query('user', 'users-permissions').find({ '_id': { $in: param } })
          }
          break;
        case 'search':
          if (param) {
            entities = await strapi.query('user', 'users-permissions').model.find({
              $or: [{ email: { $regex: param.valueFilter, $options: 'i' } }, { username: { $regex: param.valueFilter, $options: 'i' } }]
            }).limit(1000)
          }
          break;
        default:
          break;
      }
    } else {
      entities = strapi.query('user', 'users-permissions').find({ _limit: -1 });
    }

    return entities.map(entity => {
      return sanitizeEntity(entity, {
        model: strapi.query('user', 'users-permissions').model,
        includeFields: ['id', 'username', 'email', 'firstName', 'lastName']
      });
    });
  },
  async getSystemUserRole(ctx) {
    let entities
    const user = ctx.state.user
    if (user) {
      entities = user.role
    } else {
      entities = {
        name: "Public",
        type: 'public'
      }
    }
    return entities
  },
  async paginate(ctx) {
    const user = ctx.state.user
    const params = ctx.query
    const page = parseInt(params._page)
    const limit = parseInt(params._limit)
    let search
    if (params.search) {
      search = params.search.replace(/\s/g, '+');
    }


    const startIndex = (page - 1) * limit
    let entities = []
    let count = 0;
    if (!user || !user.role || !user.role.type === 'web_admin') return ctx.forbidden('You don\'t have permission');
    if (search && search !== '') {
      count = await strapi.query('user', 'users-permissions').model.count({
        $or: [{ email: { $regex: search, $options: 'i' } }, { username: { $regex: search, $options: 'i' } }],
      });
      entities = await strapi.query('user', 'users-permissions').model.find({
        $or: [{ email: { $regex: search, $options: 'i' } }, { username: { $regex: search, $options: 'i' } }]
      }).sort({ createdAt: 'desc' })
        .skip(startIndex)
        .limit(limit)
    } else {
      count = await strapi.query('user', 'users-permissions').count();
      entities = await strapi.query('user', 'users-permissions').find({ _start: startIndex, _limit: limit, _sort: 'createdAt:desc' })
    }
    if (entities && entities.length > 0) {
      const userQuery = await strapi.query('user', 'users-permissions');
      const data = sanitizeUser(entities, { model: userQuery.model });
      return entities = { data, count }
    }
    return entities = { data: entities, count }
  },
  async getUserInfo(ctx) {
    const user = ctx.state.user
    const { userId } = ctx.params
    let entities
    if (!user || !user.role || !user.role.type === 'web_admin') return ctx.forbidden('You don\'t have permission');
    entities = await strapi.plugins['users-permissions'].services.user.fetch({
      id: userId
    });
    return sanitizeEntity(entities, {
      model: strapi.query('user', 'users-permissions').model,
      includeFields: ['id', 'username', 'email', 'firstName', 'lastName', 'role', 'data']
    });
  },
  async deleteMultiUser(ctx) {
    let entity = {}
    let { arrUserId } = ctx.request.body
    let user = ctx.state.user
    if (!user) return ctx.notFound()
    if (user?.role?.type === 'admin') {
      if (arrUserId.length > 0) {
        entity = await strapi.query('user', 'users-permissions').model.deleteMany({ "_id": { $in: arrUserId } })
      }
      return entity
    }
    return ctx.notFound()
  },
  async updateUserInfo(ctx) {
    let param = ctx.request.body
    const user = ctx.state.user
    const { userId } = ctx.params
    const { email, username } = param;
    if (!user || !user.role || !user.role.type === 'web_admin') return ctx.forbidden('You don\'t have permission');
    const userUpdate = await strapi.plugins['users-permissions'].services.user.fetch({
      id: userId,
    });
    if (!userUpdate) return ctx.badRequest('user.notNull');
    const advancedConfigs = await strapi
      .store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
        key: 'advanced',
      })
      .get();

    if (_.has(param, 'email') && !email) {
      return ctx.badRequest('email.notNull');
    }

    if (_.has(param, 'username') && !username) {
      return ctx.badRequest('username.notNull');
    }

    if (_.has(param, 'username')) {
      const userWithSameUsername = await strapi
        .query('user', 'users-permissions')
        .findOne({ username });

      if (userWithSameUsername && userWithSameUsername.id !== userId) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.username.taken',
            message: 'username.alreadyTaken.',
            field: ['username'],
          })
        );
      }
    }

    if (_.has(param, 'email') && advancedConfigs.unique_email) {
      const userWithSameEmail = await strapi
        .query('user', 'users-permissions')
        .findOne({ email });

      if (userWithSameEmail && userWithSameEmail.id !== userId) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.email.taken',
            message: 'Email already taken',
            field: ['email'],
          })
        );
      }
    }



    let updateData = {
      ...param,
    };

    const data = await strapi.plugins['users-permissions'].services.user.edit(
      { id: userId },
      updateData
    );

    try {
      strapi.services.obt.sendNewUserMeNotification(updateData.email, "xD Twin - Update your profile", updateData.username, 'd-7bc50fbd6e694cd2af4d920a54fda8f7')
    } catch (err) {
      ctx.send(err)
    }
    return `Updated user ${data.username} successfully`
  },
  async createAtRegisterUser(ctx) {
    const user = ctx.state.user
    let entities = await strapi.query('user', 'users-permissions').findOne({ _id: user.id })
    if (entities) {
      await strapi.services.obt.sendRegisterUser(user.email, user.username, user.id, 'd-1b47054d837f4181ac09f3d253a0d9e5')
      return { status: 'send verify success', message: "Your account send verify success." }
    } else {
      return ctx.forbidden('You don\'t have permission ')
    }
  },
  async verifyAccount(ctx) {
    let entities
    const { id } = ctx.params
    entities = await strapi.query('user', 'users-permissions').findOne({ _id: id })
    if (entities) {
      if (entities.blocked) {
        return { status: 'blocked', blocked: true, message: "Your account has been blocked by an administrator." }
      } else {
        if (entities.isActive) {
          return { status: 'actived', isActive: true, message: "Your account actived, sign in to access website." }
        } else {
          await strapi.query('user', 'users-permissions').update({ id }, { isActive: true })
          return { status: 'verify-success', message: "Your account active success, sign in to access website." }
        }
      }
    }
  },
  async createNewUser(ctx) {
    const { id } = ctx.params;
    const { email , username , password ,address, city, country, phone, zipCode } = ctx.request.body
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    let userParam = {
      email , username , password ,address, city, country, phone, zipCode , isActive : true
    }
    const config = {
      method: 'post',
      url: `${process.env.API_URL}/auth/local/register`,
      data: userParam
    };
    let newUser = await axios(config)
      .then(function (response) {
          return response.data?.user
      })
      .catch(function (error) {
        return error
      });
    if(!newUser._id) return ctx.notFound(newUser);
    return newUser
  }
};
