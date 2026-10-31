# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## 0.0.2 (2026-10-31)

### Features

* **all:** initial commit ([948c0ee](https://github.com/Tom-Camp/bckpacking_ui/commit/948c0ee7fc5318bdc1e808f14d34be8a7ef5f207))
* **auth:** reset a forgotten password by email ([5f06c58](https://github.com/Tom-Camp/bckpacking_ui/commit/5f06c58285c2e351a7d38e982e35b664811cfab6)), closes [#93](https://github.com/Tom-Camp/bckpacking_ui/issues/93)
* **auth:** verify email addresses after registering ([0055f78](https://github.com/Tom-Camp/bckpacking_ui/commit/0055f786c761ef49d77f953c70300a3fc4e8c05c)), closes [#94](https://github.com/Tom-Camp/bckpacking_ui/issues/94)
* **gearcategory:** updating gear category to use enum ([d37a09f](https://github.com/Tom-Camp/bckpacking_ui/commit/d37a09f1447fac8848699106267e30a3589b09b5))
* **gearlist:** adding Add new gear button ([428bab8](https://github.com/Tom-Camp/bckpacking_ui/commit/428bab863d309eaa9f2f3cd08f9e7c8d79eae121))
* **passwordstrength:** adding the zxcvbn password complexity checking ([4064b3e](https://github.com/Tom-Camp/bckpacking_ui/commit/4064b3e99a5a2213b6e64bb8cbd3823363aaa21b)), closes [#1](https://github.com/Tom-Camp/bckpacking_ui/issues/1)
* **settings:** let a signed-in user change their password ([41df07c](https://github.com/Tom-Camp/bckpacking_ui/commit/41df07c7b3b6e51a4a94296c133984ccb3b150fa))
* **shared:** adding shared page ([1b25594](https://github.com/Tom-Camp/bckpacking_ui/commit/1b255949c0f4da8a013d03110a60d931aec4ea10))

### Bug Fixes

* **actions:** actions ([d959ae8](https://github.com/Tom-Camp/bckpacking_ui/commit/d959ae81d888857289963c1641b575c2d8dd0335)), closes [#27](https://github.com/Tom-Camp/bckpacking_ui/issues/27)
* **food:** cap calorie inputs at the API's integer maximum ([134d128](https://github.com/Tom-Camp/bckpacking_ui/commit/134d12842e9a428559f29ea61746b038c87ba009)), closes [#79](https://github.com/Tom-Camp/bckpacking_ui/issues/79), references [Tom-Camp/bckpacking_api#78it](https://github.com/Tom-Camp/bckpacking_ui/issues/78it)
* **forms:** block offline edits the API would reject ([bdd4e28](https://github.com/Tom-Camp/bckpacking_ui/commit/bdd4e289cb18cecb12f266551748efd16a8e773f)), closes [#56](https://github.com/Tom-Camp/bckpacking_ui/issues/56), references [Tom-Camp/bckpacking_api#46](https://github.com/Tom-Camp/bckpacking_ui/issues/46)
* **gearitemdialog:** edit offline when the category list hasn't been cached yet ([44683e5](https://github.com/Tom-Camp/bckpacking_ui/commit/44683e58ae21fa881367d3b5a8874a40563e28f9)), closes [#24](https://github.com/Tom-Camp/bckpacking_ui/issues/24)
* **gearlist:** search duplicate create bug ([f9fe272](https://github.com/Tom-Camp/bckpacking_ui/commit/f9fe272ef1e848708d4d88b5905bcc8efbe443ca)), closes [#25](https://github.com/Tom-Camp/bckpacking_ui/issues/25)
* **sync:** keep queued edits on 403 and test the concurrency paths ([aced20c](https://github.com/Tom-Camp/bckpacking_ui/commit/aced20c581d9525ee3facf4a211ecff255329f91)), closes [#57](https://github.com/Tom-Camp/bckpacking_ui/issues/57), references [Tom-Camp/bckpacking_api#44](https://github.com/Tom-Camp/bckpacking_ui/issues/44)
* **trip:** only link map links that are http(s) URLs ([89305d5](https://github.com/Tom-Camp/bckpacking_ui/commit/89305d532cbf5c9a2802fff887abe9dc7eee5e84)), closes [#55](https://github.com/Tom-Camp/bckpacking_ui/issues/55), references [Tom-Camp/bckpacking_api#59](https://github.com/Tom-Camp/bckpacking_ui/issues/59)
* **trip:** reject map links containing tabs or newlines ([9d5c1b6](https://github.com/Tom-Camp/bckpacking_ui/commit/9d5c1b64d5b54e072acbe509dae93b93275b9e39))
* **trip:** reject map links without // before the host ([543e6ea](https://github.com/Tom-Camp/bckpacking_ui/commit/543e6ea6a83860ca3816fe59ebaef2cf725e8a13))
