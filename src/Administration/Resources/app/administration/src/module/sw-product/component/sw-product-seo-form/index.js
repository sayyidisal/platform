import template from './sw-product-seo-form.html.twig';

const { Component, Mixin } = Shopware;
const { Criteria } = Shopware.Data;
const { mapPropertyErrors, mapState, mapGetters } = Shopware.Component.getComponentHelper();

Component.register('sw-product-seo-form', {
    template,

    props: {
        allowEdit: {
            type: Boolean,
            required: false,
            default: true
        }
    },

    mixins: [
        Mixin.getByName('placeholder')
    ],

    inject: [
        'repositoryFactory'
    ],

    data() {
        return {
            variants: [],
            searchTerm: '',
            canonicalProductSwitchEnabled: false,
            switchStateHasBeenSet: false,
            selectValue: null
        };
    },

    watch: {
        'product.canonicalProductId': {
            handler(value) {
                /* Return if value is undefined or the switch state has been set the very first time.
                 * The reason to return is that using `immediate` on this watcher the very first value is always `undefined`.
                 * So when the product actually has a `canonicalProductId` the switch will be initially off instead off on.
                 */
                if (value === undefined || this.switchStateHasBeenSet) {
                    return;
                }

                this.canonicalProductSwitchEnabled = !!value;
                this.switchStateHasBeenSet = true;
            },
            immediate: true
        },

        'product.id': {
            handler: function (value) {
                if (!value) {
                    return;
                }

                this.fetchVariants();
            },
            immediate: true
        },

        canonicalProductSwitchEnabled(isEnabled) {
            /* When the switch state is false it saves the variant id internally.
             * And when the switch is enabled and the value is not null it sets back the variant id.
             */
            if (isEnabled) {
                this.product.canonicalProductId = this.selectValue;
                this.selectValue = null;

                return;
            }

            this.selectValue = this.product.canonicalProductId;
            this.product.canonicalProductId = null;
        },

        isLoading(isLoading) {
            if (isLoading) {
                return;
            }

            this.selectValue = this.product.canonicalProductId;
        }
    },

    computed: {
        productRepository() {
            return this.repositoryFactory.create('product');
        },

        hasParent() {
            return !!this.parentProduct.id;
        },

        hasVariants() {
            return this.product.childCount > 0;
        },

        variantCriteria() {
            const criteria = new Criteria();

            criteria.addAssociation('options.group');

            criteria.addFilter(
                Criteria.equals('parentId', this.product.id)
            );

            if (this.searchTerm) {
                criteria.setTerm(this.searchTerm);

                // split search term by words
                const terms = this.searchTerm
                    .split(' ')
                    .filter(term => {
                        return term !== '';
                    });

                terms.forEach(term => {
                    criteria.addQuery(Criteria.equals('product.options.name', term), 3500);
                    criteria.addQuery(Criteria.contains('product.options.name', term), 500);
                });
            }

            return criteria;
        },

        isCanonicalUrlSelectLoading() {
            return this.variants.length < 1;
        },

        variantsWithResetOption() {
            const variants = this.variants;

            variants.unshift({
                id: null,
                name: this.$tc('sw-product.seoForm.placeholderCanonicalProduct')
            });

            return variants;
        },

        ...mapGetters('swProductDetail', [
            'isLoading'
        ]),

        ...mapState('swProductDetail', [
            'product',
            'parentProduct'
        ]),

        ...mapPropertyErrors('product', [
            'keywords',
            'metaDescription',
            'metaTitle'
        ])
    },

    methods: {
        fetchVariants() {
            return this.productRepository.search(this.variantCriteria, Shopware.Context.api).then(variants => {
                this.variants = variants;

                return variants;
            });
        },

        getItemName(item) {
            if (!item.id) {
                return item.name;
            }

            return item.translated.name || this.product.translated.name;
        },

        onSearch(searchTerm) {
            this.searchTerm = searchTerm;

            this.fetchVariants().then(variants => {
                this.$refs.canonicalProductSelect.results = variants;

                this.$nextTick().then(() => {
                    this.$refs.canonicalProductSelect.resetActiveItem();
                });
            });
        }
    }
});
