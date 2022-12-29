'use strict';

/**
 * Read the documentation () to implement custom service functions
 */

module.exports = {
    async delete(user) { 
        var projectuserrole = await strapi.query('projectuserrole').find({ email: user.email })
        if (projectuserrole) {
            projectuserrole.forEach(async m => {
                try {
                    await strapi.query('projectuserrole').delete({ id: m.id })
                } catch (error) {
                    console.log(error)
                }
            })
        }

        return await strapi.plugins['users-permissions'].services.user.remove({ id: user.id })
    },
};
