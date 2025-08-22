// import { withPluginApi } from "discourse/lib/plugin-api";
//
// export default {
//   name: "lottery-form-initializer",
//   initialize() {
//     withPluginApi("1.0.0", (api) => {
//       api.modifyClass("controller:composer", {
//         pluginId: "discourse-lottery-v3",
//         save(options) {
//           const lotteryData = this.get("model.lotteryFormData");
//           if (lotteryData) {
//             this.get("model").set("custom_fields.lottery", JSON.stringify(lotteryData));
//           }
//           return this._super(options);
//         },
//       });
//     });
//   },
// };
