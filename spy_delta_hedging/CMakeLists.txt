project(example_spy_delta_hedging LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(example_spy_delta_hedging main.cpp)

target_link_libraries(example_spy_delta_hedging
  PRIVATE abzu::aurum
)
