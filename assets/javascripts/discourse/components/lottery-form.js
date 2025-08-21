import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import I18n from "discourse-i18n";

export default class LotteryForm extends Component {
  @tracked minParticipantsError = null;

  get shouldShow() {
    const s = this.args.siteSettings;
    const m = this.args.model;

    // 所有关键对象判空
    if (!s?.lottery_enabled || !m) return false;
    const allowedCats = (s.lottery_allowed_categories || "")
      .split("|")
      .map(Number)
      .filter(Boolean);

    return (
      m.action === "createTopic" &&
      !!m.categoryId &&
      allowedCats.length > 0 &&
      allowedCats.includes(m.categoryId)
    );
  }

  // 保证表单数据总是对象，所有字段都有默认值
  get lotteryData() {
    const m = this.args.model;
    if (!m.lotteryFormData) m.lotteryFormData = {};

    let data = m.lotteryFormData;
    if (!("prize_name" in data)) data.prize_name = "";
    if (!("prize_details" in data)) data.prize_details = "";
    if (!("draw_time" in data)) data.draw_time = null;
    if (!("winners_count" in data)) data.winners_count = 1;
    if (!("specified_post_numbers" in data)) data.specified_post_numbers = "";
    if (!("min_participants" in data)) data.min_participants = 1;
    if (!("backup_strategy" in data)) data.backup_strategy = "";

    return data;
  }

  backupStrategyOptions = [
    { id: "continue", name: I18n.t("lottery.form.backup_strategy.options.continue") },
    { id: "cancel", name: I18n.t("lottery.form.backup_strategy.options.cancel") }
  ];

  @action
  updateLotteryData(field, event) {
    this.lotteryData[field] = event.target.value;
  }

  @action
  updateLotteryDataFromComponent(field, value) {
    this.lotteryData[field] = value;
  }

  @action
  validateMinParticipants(value) {
    const s = this.args.siteSettings;
    this.lotteryData["min_participants"] = value;
    if (value && parseInt(value, 10) < (s.lottery_min_participants_global || 1)) {
      this.minParticipantsError = I18n.t("lottery.form.min_participants.error", { count: s.lottery_min_participants_global || 1 });
    } else {
      this.minParticipantsError = null;
    }
  }
}
