'use strict';
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async getTree(ctx) {
    const { fileid } = ctx.params
    const rootNodes = await strapi.query('objectinfo').model.aggregate([
      {
        $match: {
          $or: [
            { fileid },
            { parent: "ffffffffffffffffffffffff" }
          ]
        }
      },
      {
        $graphLookup: {
          from: "datas",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parent",
          depthField: "level",
          as: "children"
        }
      },
      {
        $unwind: {
          path: "$children",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $sort: {
          "children.level": -1
        }
      },
      {
        $group: {
          _id: "$_id",
          parent: {
            $first: "$parent"
          },
          name: {
            $first: "$name"
          },
          type: {
            $first: 1
          },
          fileid: {
            $first: "$fileid"
          },
          projectid: {
            $first: "$projectid"
          },
          inf: {
            $first: "$inf"
          },
          children: {
            $push: "$children"
          }
        }
      },
      {
        $addFields: {
          children: {
            $reduce: {
              input: "$children",
              initialValue: {
                level: -1,
                presentChild: [],
                prevChild: []
              },
              in: {
                $let: {
                  vars: {
                    prev: {
                      $cond: [
                        {
                          $eq: [
                            "$$value.level",
                            "$$this.level"
                          ]
                        },
                        "$$value.prevChild",
                        "$$value.presentChild"
                      ]
                    },
                    current: {
                      $cond: [
                        {
                          $eq: [
                            "$$value.level",
                            "$$this.level"
                          ]
                        },
                        "$$value.presentChild",
                        []
                      ]
                    }
                  },
                  in: {
                    level: "$$this.level",
                    prevChild: "$$prev",
                    presentChild: {
                      $concatArrays: [
                        "$$current",
                        [
                          {
                            $mergeObjects: [
                              "$$this",
                              {
                                children: {
                                  $filter: {
                                    input: "$$prev",
                                    as: "e",
                                    cond: {
                                      $eq: [
                                        "$$e.parent",
                                        "$$this._id"
                                      ]
                                    }
                                  }
                                }
                              }
                            ]
                          }
                        ]
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          id: "$_id",
          children: "$children.presentChild"
        }
      }
    ]).lean().exec();
    return rootNodes;
  },
  async getTreeRecursive(nodes, fileid, count) {
    const tree = [];
    for (const node of nodes) {
      const children = await strapi.query('objectinfo').model.find({ parent: node._id , fileid }).lean().exec();
      if (children && children.length > 0 && count > 0) {
        node.children = await this.getTreeRecursive(children, fileid, count - 1);
      }
      tree.push(node);
    }
    return tree;
  },
  // async getTree(ctx) {
  //   const { fileid } = ctx.params
  //   const rootNodes = await strapi.query('objectinfo').model.find({ parent: "ffffffffffffffffffffffff" , fileid }).lean().exec();
  //   const tree = await this.getTreeRecursive(rootNodes, fileid);
  //   return tree;
  // },
  // async getTreeRecursive(nodes, fileid) {
  //   const tree = [];
  //   for (const node of nodes) {
  //     const children = await strapi.query('objectinfo').model.find({ parent: node._id , fileid}).lean().exec();
  //     // if (children && children.length > 0 && count > 0) {
  //       node.children = await this.getTreeRecursive(children, fileid);
  //     // }
  //     tree.push(node);
  //   }
  //   return tree;
  // }
};
