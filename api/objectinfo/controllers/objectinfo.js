'use strict';
const {
  Types: { ObjectId: ObjectId },
} = require("mongoose");
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async getTree() {
    let id =  ObjectId('ffffffffffffffffffffffff')
    const rootNodes = await strapi.query('objectinfo').model.find({parent : id}).lean().exec();

    const tree = await this.getTreeRecursive(rootNodes);

    return tree;
  },
  async getTreeRecursive(nodes) {
    const tree = [];
    for (const node of nodes) {
      let data  =  node._id
      const children = await strapi.query('objectinfo').model.find({ parent: data }).lean()
        .exec();
      node.children = await this.getTreeRecursive(children);
      tree.push(node);
    }

    return tree;
  }
};
