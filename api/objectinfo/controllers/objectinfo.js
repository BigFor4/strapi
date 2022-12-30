'use strict';
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */
const {
  Types: { ObjectId: ObjectId },
} = require("mongoose");
module.exports = {
  async getTree(ctx) {
    const { fileid } = ctx.params
    let parent = ObjectId('ffffffffffffffffffffffff')
    const rootNodes = await strapi.query('objectinfo').model.aggregate([
      {
        $match: {
          $and: [
            { fileid },
            { parent }
          ]
        }
      },
      {
        $addFields: {
          key: '$_id',
        }
      },
      {
        $graphLookup: {
          from: "ObjectInfor",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parent",
          depthField: "level",
          as: "children",
          maxDepth: 6
        }
      },
      {
        $addFields: {
          children: {
            $map: {
              input: '$children',
              as: 'child',
              in: {
                _id: '$$child._id',
                key: '$$child._id',
                parent: '$$child.parent',
                title: '$$child.name',
                type: '$$child.type',
                fileid: '$$child.fileid',
                projectid: '$$child.projectid',
                level: '$$child.level',
              },
            },
          },
        },
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
          _id: '$_id',
          parent: {
            $first: '$parent',
          },
          key: {
            $first: '$_id',
          },
          title: {
            $first: '$title',
          },
          type: {
            $first: '$type',
          },
          guid: {
            $first: '$guid',
          },
          fileid: {
            $first: '$fileid',
          },
          projectid: {
            $first: '$projectid',
          },
          children: {
            $push: '$children',
          },
        },
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
    ]);
    return rootNodes;
  },
  async getTreeGuid(ctx) {
    const { guid, fileid } = ctx.request.body
    const rootNodes = await strapi.query('objectinfo').model.aggregate([
      {
        $match: {
          $and: [
            { fileid },
            { guid }
          ]
        }
      },
      {
        $lookup: {
          from: 'datas',
          localField: 'parent',
          foreignField: '_id',
          as: 'parent_level_1',
        },
      },
      {
        $lookup: {
          from: 'datas',
          localField: 'parent_level_1.parent',
          foreignField: '_id',
          as: 'parent_level_2',
        },
      },
      {
        $project: {
          _id: {
            $cond: [
              {
                $eq: ['$parent_level_2._id', []],
              },
              '$_id',
              { $arrayElemAt: ['$parent_level_2._id', 0] },
            ],
          },
          guid: {
            $cond: [
              {
                $eq: ['$parent_level_2.guid', []],
              },
              '$guid',
              { $arrayElemAt: ['$parent_level_2.guid', 0] },
            ],
          },
          title: {
            $cond: [
              {
                $eq: ['$parent_level_2.name', []],
              },
              '$name',
              { $arrayElemAt: ['$parent_level_2.name', 0] },
            ],
          },
          fileid: {
            $cond: [
              {
                $eq: ['$parent_level_2.fileid', []],
              },
              '$fileid',
              { $arrayElemAt: ['$parent_level_2.fileid', 0] },
            ],
          },
          projectid: {
            $cond: [
              {
                $eq: ['$parent_level_2.projectid', []],
              },
              '$projectid',
              { $arrayElemAt: ['$parent_level_2.projectid', 0] },
            ],
          },
          type: {
            $cond: [
              {
                $eq: ['$parent_level_2.type', []],
              },
              '$type',
              { $arrayElemAt: ['$parent_level_2.type', 0] },
            ],
          },
          parent: {
            $cond: [
              {
                $ne: ['$parent_level_2.parent', []],
              },
              '$parent',
              { $arrayElemAt: ['$parent_level_2.parent', 0] },
            ],
          },
        },
      },
      {
        $addFields: {
          key: '$_id',
        }
      },
      {
        $graphLookup: {
          from: 'datas',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parent',
          depthField: 'level',
          as: 'children',
          maxDepth: 6,
        },
      },
      {
        $addFields: {
          children: {
            $map: {
              input: '$children',
              as: 'child',
              in: {
                _id: '$$child._id',
                key: '$$child._id',
                parent: '$$child.parent',
                title: '$$child.name',
                type: '$$child.type',
                fileid: '$$child.fileid',
                projectid: '$$child.projectid',
                level: '$$child.level',
              },
            },
          },
        },
      },
      {
        $unwind: {
          path: '$children',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: {
          'children.level': -1,
        },
      },
      {
        $group: {
          _id: '$_id',
          parent: {
            $first: '$parent',
          },
          key: {
            $first: '$_id',
          },
          title: {
            $first: '$title',
          },
          type: {
            $first: '$type',
          },
          fileid: {
            $first: '$fileid',
          },
          projectid: {
            $first: '$projectid',
          },
          children: {
            $push: '$children',
          },
        },
      },
      {
        $addFields: {
          children: {
            $reduce: {
              input: '$children',
              initialValue: {
                level: -1,
                presentChild: [],
                prevChild: [],
              },
              in: {
                $let: {
                  vars: {
                    prev: {
                      $cond: [
                        {
                          $eq: ['$$value.level', '$$this.level'],
                        },
                        '$$value.prevChild',
                        '$$value.presentChild',
                      ],
                    },
                    current: {
                      $cond: [
                        {
                          $eq: ['$$value.level', '$$this.level'],
                        },
                        '$$value.presentChild',
                        [],
                      ],
                    },
                  },
                  in: {
                    level: '$$this.level',
                    prevChild: '$$prev',
                    presentChild: {
                      $concatArrays: [
                        '$$current',
                        [
                          {
                            $mergeObjects: [
                              '$$this',
                              {
                                children: {
                                  $filter: {
                                    input: '$$prev',
                                    as: 'e',
                                    cond: {
                                      $eq: ['$$e.parent', '$$this._id'],
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        ],
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          id: '$_id',
          children: '$children.presentChild',
        },
      },
    ]);
    return rootNodes;
  }
};
