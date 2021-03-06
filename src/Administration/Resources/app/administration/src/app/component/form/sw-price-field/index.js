import template from './sw-price-field.html.twig';
import './sw-price-field.scss';

const { Component, Application } = Shopware;
const utils = Shopware.Utils;

/**
 * @public
 * @status ready
 * @example-type static
 * @component-example
 * <sw-price-field :taxRate="{ taxRate: 19 }"
 *                 :price="[{ net: 10, gross: 11.90, currencyId: '...' }, ...]"
 *                 :defaultPrice="{...}"
 *                 :currency="{...}">
 * </sw-price-field>
 */
Component.register('sw-price-field', {
    template,

    inheritAttrs: false,

    props: {
        price: {
            type: Array,
            required: true,
            default() {
                return [];
            }
        },

        defaultPrice: {
            type: Object,
            required: false,
            default() {
                return {};
            }
        },

        taxRate: {
            type: Object,
            required: true,
            default() {
                return {};
            }
        },

        currency: {
            type: Object,
            required: true,
            default() {
                return {};
            }
        },

        validation: {
            required: false,
            default: null
        },

        label: {
            required: false,
            default: true
        },

        compact: {
            required: false,
            default: false
        },

        error: {
            type: Object,
            required: false,
            default: null
        },

        disabled: {
            required: false,
            default: false
        },

        disableSuffix: {
            type: Boolean,
            required: false,
            default: false
        },

        grossLabel: {
            type: String,
            required: false,
            default: null
        },

        netLabel: {
            type: String,
            required: false,
            default: null
        },

        name: {
            type: String,
            required: false,
            default: null
        },

        allowEmpty: {
            type: Boolean,
            required: false,
            default: false
        },

        inherited: {
            type: Boolean,
            required: false,
            default: undefined
        }
    },

    watch: {
        'priceForCurrency.linked': function priceLinkedWatcher(value) {
            if (value === true && this.priceForCurrency.gross !== null) {
                this.convertGrossToNet(this.priceForCurrency.gross);
            }
        },

        'taxRate.id': function taxRateWatcher() {
            if (this.priceForCurrency.linked === true && this.priceForCurrency.gross !== null) {
                this.convertGrossToNet(this.priceForCurrency.gross);
            }
        }
    },

    computed: {
        calculatePriceApiService() {
            return Application.getContainer('factory').apiService.getByName('calculate-price');
        },

        priceForCurrency: {
            get() {
                const priceForCurrency = Object.values(this.price).find((price) => {
                    return price.currencyId === this.currency.id;
                });

                // check if price exists
                if (priceForCurrency) {
                    return priceForCurrency;
                }

                // Calculate values if inherited
                if (this.isInherited) {
                    return {
                        currencyId: this.currency.id,
                        gross: this.defaultPrice.gross ? this.convertPrice(this.defaultPrice.gross) : null,
                        linked: this.defaultPrice.linked,
                        net: this.defaultPrice.net ? this.convertPrice(this.defaultPrice.net) : null
                    };
                }

                return {
                    currencyId: this.currency.id,
                    gross: null,
                    linked: this.defaultPrice.linked,
                    net: null
                };
            },
            set(newValue) {
                this.priceForCurrency.gross = newValue.gross;
                this.priceForCurrency.linked = newValue.linked;
                this.priceForCurrency.net = newValue.net;
            }
        },

        isInherited() {
            if (this.inherited !== undefined) {
                return this.inherited;
            }

            const priceForCurrency = Object.values(this.price).find((price) => {
                return price.currencyId === this.currency.id;
            });

            return !priceForCurrency;
        },

        isDisabled() {
            return this.isInherited || this.disabled;
        },

        labelGross() {
            const label = this.grossLabel ? this.grossLabel : this.$tc('global.sw-price-field.labelPriceGross');
            return this.label ? label : '';
        },

        labelNet() {
            const label = this.netLabel ? this.netLabel : this.$tc('global.sw-price-field.labelPriceNet');
            return this.label ? label : '';
        },

        grossError() {
            return this.error ? this.error.gross : null;
        },

        netError() {
            return this.error ? this.error.net : null;
        },

        grossFieldName() {
            return this.name ? `${this.name}-gross` : 'sw-price-field-gross';
        },

        netFieldName() {
            return this.name ? `${this.name}-net` : 'sw-price-field-net';
        }
    },

    methods: {
        onLockSwitch() {
            if (this.isDisabled) {
                return;
            }
            this.priceForCurrency.linked = !this.priceForCurrency.linked;
            this.$emit('price-lock-change', this.priceForCurrency.linked);
            this.$emit('change', this.priceForCurrency);
        },

        onPriceGrossChange(value) {
            this.priceForCurrency.gross = value;

            if (this.priceForCurrency.linked) {
                this.$emit('price-calculate', true);
                this.onPriceGrossChangeDebounce(value);
            }
        },

        onPriceGrossChangeDebounce: utils.debounce(function onPriceGrossChange(value) {
            this.$emit('price-gross-change', value);
            this.$emit('change', this.priceForCurrency);

            this.convertGrossToNet(value);
        }, 500),

        onPriceNetChange(value) {
            this.priceForCurrency.net = value;

            if (this.priceForCurrency.linked) {
                this.$emit('price-calculate', true);
                this.onPriceNetChangeDebounce(value);
            }
        },

        onPriceNetChangeDebounce: utils.debounce(function onPriceNetChange(value) {
            this.$emit('price-net-change', value);
            this.$emit('change', this.priceForCurrency);

            this.convertNetToGross(value);
        }, 500),

        convertNetToGross(value) {
            if (Number.isNaN(value)) {
                this.priceForCurrency.gross = this.allowEmpty ? null : 0;
                return false;
            }

            if (!value) {
                this.priceForCurrency.gross = 0;
                return false;
            }
            this.$emit('price-calculate', true);

            this.requestTaxValue(value, 'net').then((res) => {
                this.priceForCurrency.gross = this.priceForCurrency.net + res;
            });
            return true;
        },

        convertGrossToNet(value) {
            if (Number.isNaN(value)) {
                this.priceForCurrency.net = this.allowEmpty ? null : 0;
                this.$emit('calculating', false);
                return false;
            }

            if (!value) {
                this.priceForCurrency.net = 0;
                this.$emit('calculating', false);
                return false;
            }
            this.$emit('price-calculate', true);

            this.requestTaxValue(value, 'gross').then((res) => {
                this.priceForCurrency.net = this.priceForCurrency.gross - res;
            });
            return true;
        },

        requestTaxValue(value, outputType) {
            this.$emit('price-calculate', true);
            return new Promise((resolve) => {
                if (
                    !value ||
                    typeof value !== 'number' ||
                    !this.priceForCurrency[outputType] ||
                    !this.taxRate.id ||
                    !outputType
                ) {
                    return null;
                }

                this.calculatePriceApiService.calculatePrice({
                    taxId: this.taxRate.id,
                    currencyId: this.currency.id,
                    price: this.priceForCurrency[outputType],
                    output: outputType
                }).then(({ data }) => {
                    resolve(data.calculatedTaxes[0].tax);
                    this.$emit('price-calculate', false);
                });
                return true;
            });
        },

        convertPrice(value) {
            const calculatedPrice = value * this.currency.factor;
            const priceRounded = calculatedPrice.toFixed(this.currency.decimalPrecision);
            return Number(priceRounded);
        },

        keymonitor(event) {
            if (event.key === ',') {
                const value = event.currentTarget.value;
                event.currentTarget.value = value.replace(/.$/, '.');
            }
        }
    }
});
