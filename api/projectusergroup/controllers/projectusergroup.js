'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */
const {
  Types: { ObjectId: ObjectId },
} = require("mongoose");
module.exports = {
  async updateAccessControl(ctx) {
    const user = ctx.state.user;
    const { projectId } = ctx.params
    const { groupId, key, type, accessControl } = ctx.request.body;
    if (!user) return ctx.unauthorized();
    let project = await strapi.services.project.findOne({ id: projectId });
    if (!project) return ctx.notFound('Project not really exist');
    let listKeyFolder = []
    let listKeyFile = []
    let listAllKey = []
    const getAllKeyFolder = (data) => {
      data.map(item => {
        if (item.type === "FOLDER" && !item.isDeleted) {
          listKeyFolder.push(item.key)
        }
        if (item.type === "FILE" && !item.isDeleted) {
          listKeyFile.push(item.key)
        }
        listAllKey.push(item.key)
        if (item.children) {
          getAllKeyFolder(item.children)
        }
      })
    }
    getAllKeyFolder(project.treeData)
    if (!listAllKey.includes(key)) {
      return ctx.notFound('The node is not in the project data tree');
    }
    const userGroup = await await strapi.query('projectusergroup').findOne(
      { id: groupId }
    )
    if (type === "FOLDER") {
      if (userGroup.accessFolder?.length > 0) {
        let accessFolder = userGroup.accessFolder;
        let index = userGroup.accessFolder.findIndex(x => x.key === key);
        if (index > -1) {
          accessFolder[index].accessControl = accessControl
        } else {
          accessFolder.push({ key, accessControl })
        }
        let data = await strapi.query('projectusergroup').update(
          { id: groupId },
          { accessFolder: accessFolder.filter(x => listKeyFolder.includes(x.key)) }
        );
        return data
      } else {
        let data = await strapi.query('projectusergroup').update(
          { id: groupId },
          {
            accessFolder: [
              { key, accessControl }
            ]
          }
        );
        return data
      }
    }
    else if (type === "FILE") {
      if (userGroup.accessFile?.length > 0) {
        let accessFile = userGroup.accessFile;
        let index = userGroup.accessFile.findIndex(x => x.key === key);
        if (index > -1) {
          accessFile[index].accessControl = accessControl
        } else {
          accessFile.push({ key, accessControl })
        }
        let data = await strapi.query('projectusergroup').update(
          { id: groupId },
          { accessFile: accessFile.filter(x => listKeyFile.includes(x.key)) }
        );
        return data
      } else {
        let data = await strapi.query('projectusergroup').update(
          { id: groupId },
          {
            accessFile: [
              { key, accessControl }
            ]
          }
        );
        return data
      }
    }
  }
};
