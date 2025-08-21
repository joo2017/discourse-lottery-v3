import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import I18n from "discourse-i18n";

export default class LotteryForm extends Component {
  @tracked minParticipantsError = null;

  get shouldShow() {
    const s = this.args.siteSettings;
    const m = this.args.model;

    if (!s?.lottery_enabled || !m) return false;
    const allowedCats = (s.lottery_allowed_categories || "")
      .split("|")
      .map(Number)
      .filter(Boolean);

    // 必须选定可用分类，并且是新主题
    return (
      m.action === "createTopic" &&
      !!m.categoryId &&
      allowedCats.length > 0 &&
      allowedCats.includes(m.categoryId)
    );
  }

  get lotteryData() {
    // 所有表单字段强制初始化，避免 undefined
    const m = this.args.model;
    if (!m.lotteryFormData) m.lotteryFormData = {};
    let data = m.lotteryFormData;
    data.prize_name = data.prize_name || "";
    data.prize_details = data.prize_details || "";
    data.draw_time = data.draw_time || null;
    data.winners_count = data.winners_count ?? 1;
    data.specified_post_numbers = data.specified_post_numbers || "";
    data.min_participants = data.min_participants ?? 1;
    data.backup_strategy = data.backup_strategy || "";

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
